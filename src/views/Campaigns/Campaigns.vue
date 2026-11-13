<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import {
  Building2,
  Users,
  Plus,
  Loader2,
  FileText,
  Image as ImageIcon,
  Layers,
  FolderOpen,
} from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";

const router = useRouter();

// ==========================================
// INTERFACES
// ==========================================
interface UserTeam {
  teamId?: string;
  id?: string;
  teamName: string;
  role?: string;
}

interface TeamCampaign {
  campaignId: string;
  name: string;
  status: string;
}

interface CampaignPost {
  postId: string;
  caption?: string;
  status?: string;
}

interface UserPostAsset {
  media?: {
    id: string;
    fileName: string;
  };
  sequenceOrder?: number;
}

interface UserPostInfo {
  id: string;
  caption: string;
  createdAt: string;
  status: string;
  assets: UserPostAsset[];
}

// ==========================================
// ESTADO: Listagem e Seleção
// ==========================================
const teams = ref<UserTeam[]>([]);
const selectedTeamId = ref("");
const campaigns = ref<TeamCampaign[]>([]);
const isFetchingTeams = ref(true);
const isFetchingCampaigns = ref(false);

// ==========================================
// ESTADO: Criação de Campanha (Modal)
// ==========================================
const isCreateCampaignDialogOpen = ref(false);
const modalTeamId = ref("");
const campaignName = ref("");
const isLoading = ref(false);

// ==========================================
// ESTADO: Visualização de Postagens
// ==========================================
const isPostsDialogOpen = ref(false);
const selectedCampaign = ref<TeamCampaign | null>(null);
const campaignPosts = ref<CampaignPost[]>([]);
const isFetchingPosts = ref(false);
const userPostsMap = ref<Map<string, UserPostInfo>>(new Map());
const isUserPostsLoaded = ref(false);

const getMediaPublicUrl = (mediaId?: string) => {
  if (!mediaId) return "";
  return `${import.meta.env.VITE_RENDER_API_URL}/media/public/${mediaId}`;
};

const fetchUserPosts = async () => {
  if (isUserPostsLoaded.value) return;
  try {
    const response = await apiFetch("/identity/users/me/posts?pageSize=100");
    if (response.ok) {
      const data = await response.json();
      const list: UserPostInfo[] = data.items || data.posts || (Array.isArray(data) ? data : []);
      const map = new Map<string, UserPostInfo>();
      list.forEach((p) => {
        if (p.id) map.set(p.id.toLowerCase(), p);
      });
      userPostsMap.value = map;
      isUserPostsLoaded.value = true;
    }
  } catch (e) {
    console.warn("Não foi possível carregar enriquecimento de postagens", e);
  }
};

const getPostThumbnail = (postId: string) => {
  if (!postId) return "";
  const userPost = userPostsMap.value.get(postId.toLowerCase());
  const firstAsset = userPost?.assets?.[0];
  if (firstAsset?.media?.id) {
    return getMediaPublicUrl(firstAsset.media.id);
  }
  return "";
};

const getPostAssetsCount = (postId: string) => {
  if (!postId) return 0;
  const userPost = userPostsMap.value.get(postId.toLowerCase());
  return userPost?.assets?.length || 0;
};

const formatStatus = (status?: string) => {
  if (!status) return "Criado";
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "created":
      return "Criado";
    case "scheduled":
      return "Agendado";
    case "published":
      return "Publicado";
    case "cancelled":
    case "canceled":
      return "Cancelado";
    default:
      return status;
  }
};

const getStatusBadgeClasses = (status?: string) => {
  if (!status) return "bg-gray-100 text-gray-700 border-gray-200";
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "created":
      return "bg-gray-100 text-gray-700 border-gray-200";
    case "scheduled":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "published":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "cancelled":
    case "canceled":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

// ==========================================
// ESTADO: Diálogos de Feedback
// ==========================================
const isSuccessDialogOpen = ref(false);
const isErrorDialogOpen = ref(false);
const errorMessage = ref("");

// ==========================================
// MÉTODOS: Carregamento de Dados
// ==========================================
const fetchTeams = async () => {
  isFetchingTeams.value = true;
  try {
    const response = await apiFetch("/identity/users/me/teams");
    if (!response.ok) throw new Error("Erro ao carregar os times do usuário.");

    const data = await response.json();
    teams.value = data.teams || [];

    if (teams.value.length > 0) {
      const firstTeam = teams.value[0];
      const firstId = firstTeam.teamId || firstTeam.id || "";
      selectedTeamId.value = firstId;
      modalTeamId.value = firstId;
      await fetchCampaigns(firstId);
    }
  } catch (error: any) {
    showError(error.message || "Falha ao conectar com o servidor.");
  } finally {
    isFetchingTeams.value = false;
  }
};

const fetchCampaigns = async (teamId: string) => {
  if (!teamId) {
    campaigns.value = [];
    return;
  }

  isFetchingCampaigns.value = true;
  try {
    const response = await apiFetch(`/workflow/teams/${teamId}/campaigns`);
    if (!response.ok) throw new Error("Erro ao buscar as campanhas do time.");

    const data = await response.json();
    campaigns.value = data.campaigns || [];
  } catch (error: any) {
    showError(error.message || "Falha na comunicação com o servidor.");
  } finally {
    isFetchingCampaigns.value = false;
  }
};

const handleTeamChange = () => {
  fetchCampaigns(selectedTeamId.value);
};

// ==========================================
// MÉTODOS: Criação de Campanha
// ==========================================
const openCreateModal = () => {
  modalTeamId.value = selectedTeamId.value || (teams.value[0]?.teamId || teams.value[0]?.id || "");
  campaignName.value = "";
  isCreateCampaignDialogOpen.value = true;
};

const handleCreateCampaign = async () => {
  if (!campaignName.value.trim() || !modalTeamId.value) return;

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const response = await apiFetch(`/workflow/teams/${modalTeamId.value}/campaigns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        campaignName: campaignName.value.trim(),
      }),
    });

    const rawText = await response.text();

    if (!response.ok) {
      let apiMessage = "Erro ao cadastrar campanha.";
      if (rawText) {
        try {
          const errorData = JSON.parse(rawText);
          apiMessage =
            errorData.detail || errorData.message || errorData.title || rawText;
        } catch {
          apiMessage = rawText;
        }
      }
      throw new Error(apiMessage);
    }

    isCreateCampaignDialogOpen.value = false;
    campaignName.value = "";
    isSuccessDialogOpen.value = true;

    // Se a campanha criada for do time atualmente selecionado, recarrega a tabela
    if (modalTeamId.value === selectedTeamId.value) {
      fetchCampaigns(selectedTeamId.value);
    } else {
      selectedTeamId.value = modalTeamId.value;
      fetchCampaigns(modalTeamId.value);
    }
  } catch (error: any) {
    showError(error.message || "Falha na comunicação com o servidor.");
  } finally {
    isLoading.value = false;
  }
};

// ==========================================
// MÉTODOS: Visualização de Postagens
// ==========================================
const viewCampaignPosts = async (campaign: TeamCampaign) => {
  selectedCampaign.value = campaign;
  campaignPosts.value = [];
  isPostsDialogOpen.value = true;
  isFetchingPosts.value = true;

  try {
    const [campaignPostsResponse] = await Promise.all([
      apiFetch(
        `/workflow/teams/${selectedTeamId.value}/campaigns/${campaign.campaignId}/posts`
      ),
      fetchUserPosts(),
    ]);

    if (!campaignPostsResponse.ok) throw new Error("Erro ao buscar postagens da campanha.");

    const data = await campaignPostsResponse.json();
    campaignPosts.value = data.posts || [];
  } catch (error: any) {
    showError(error.message || "Não foi possível carregar as postagens da campanha.");
  } finally {
    isFetchingPosts.value = false;
  }
};

const showError = (msg: string) => {
  errorMessage.value = msg;
  isErrorDialogOpen.value = true;
};

onMounted(() => {
  fetchTeams();
});
</script>

<template>
  <div class="flex min-h-screen bg-gray-50">
    <AppSidebar />

    <main class="flex-1 overflow-auto">
      <div class="p-8">
        <!-- Cabeçalho da Página -->
        <div class="mb-8 max-w-4xl">
          <h1 class="text-2xl font-semibold text-gray-900 mb-2">Campanhas</h1>
          <p class="text-gray-600">
            Crie campanhas e organize as iniciativas de marketing da sua equipe.
          </p>
        </div>

        <!-- Card da Tabela -->
        <div
          class="max-w-4xl bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
        >
          <!-- Cabeçalho da Tabela com Filtro e Botão Superior Direito -->
          <div
            class="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div class="flex items-center gap-3">
              <h2 class="text-lg font-semibold text-gray-900">
                Histórico de Campanhas
              </h2>

              <!-- Seletor de Time para visualização -->
              <div v-if="teams.length > 0" class="flex items-center">
                <select
                  v-model="selectedTeamId"
                  @change="handleTeamChange"
                  class="text-xs font-medium border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-vibrant-green transition-all"
                >
                  <option
                    v-for="team in teams"
                    :key="team.teamId || team.id"
                    :value="team.teamId || team.id"
                  >
                    Time: {{ team.teamName }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Botão Adicionar no Canto Superior Direito -->
            <button
              type="button"
              @click="openCreateModal"
              :disabled="teams.length === 0"
              class="flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2.5 px-4 rounded-lg transition-all shadow-sm text-sm disabled:opacity-50"
            >
              <Plus class="w-4 h-4 mr-2" />
              Adicionar Campanha
            </button>
          </div>

          <!-- Corpo da Tabela / Estados -->
          <div class="p-0">
            <!-- Carregando -->
            <div
              v-if="isFetchingTeams || isFetchingCampaigns"
              class="flex justify-center p-8"
            >
              <Loader2 class="w-6 h-6 text-vibrant-green animate-spin" />
            </div>

            <!-- Sem times cadastrados -->
            <div
              v-else-if="teams.length === 0"
              class="p-8 text-center space-y-3"
            >
              <div class="flex justify-center">
                <Users class="w-10 h-10 text-gray-400" />
              </div>
              <p class="text-gray-800 font-medium">Nenhum time encontrado</p>
              <p class="text-sm text-gray-500 max-w-sm mx-auto">
                Para cadastrar e visualizar campanhas, você precisa fazer parte de pelo menos uma equipe.
              </p>
              <div>
                <button
                  type="button"
                  @click="router.push('/teams')"
                  class="inline-flex items-center text-sm bg-vibrant-green text-white font-medium py-2 px-4 rounded-lg hover:bg-vibrant-green/90 transition-all"
                >
                  <Plus class="w-4 h-4 mr-1.5" />
                  Cadastrar Time
                </button>
              </div>
            </div>

            <!-- Tabela de Campanhas -->
            <Table v-else>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Campanha</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead class="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="campaigns.length === 0">
                  <TableCell colspan="3" class="text-center text-gray-500 py-8">
                    Nenhuma campanha cadastrada para esta equipe.
                  </TableCell>
                </TableRow>
                <TableRow v-for="campaign in campaigns" :key="campaign.campaignId">
                  <TableCell class="font-medium text-gray-900">
                    {{ campaign.name }}
                  </TableCell>
                  <TableCell>
                    <span
                      :class="[
                        'px-2.5 py-1 text-xs rounded-full font-medium',
                        campaign.status === 'Active' || campaign.status === 'Ativo'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      ]"
                    >
                      {{
                        campaign.status === "Active"
                          ? "Ativa"
                          : campaign.status === "Inactive"
                          ? "Inativa"
                          : campaign.status
                      }}
                    </span>
                  </TableCell>
                  <TableCell class="text-right">
                    <button
                      @click="viewCampaignPosts(campaign)"
                      class="inline-flex items-center text-xs text-vibrant-green hover:bg-soft-green/30 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-vibrant-green/20 font-medium"
                      title="Ver postagens vinculadas"
                    >
                      <FileText class="w-3.5 h-3.5 mr-1" />
                      Postagens
                    </button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <!-- Modal de Cadastro de Campanha -->
        <Dialog v-model:open="isCreateCampaignDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle class="text-gray-900 flex items-center">
                <Building2 class="w-5 h-5 mr-2 text-vibrant-green" />
                Nova Campanha
              </DialogTitle>
              <DialogDescription>
                Preencha as informações para cadastrar uma nova campanha.
              </DialogDescription>
            </DialogHeader>

            <form @submit.prevent="handleCreateCampaign" class="space-y-4 mt-2">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                  >Time Responsável *</label
                >
                <div class="relative">
                  <Users class="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <select
                    v-model="modalTeamId"
                    class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent outline-none transition-all text-gray-900 bg-white"
                    required
                    :disabled="isLoading"
                  >
                    <option
                      v-for="team in teams"
                      :key="team.teamId || team.id"
                      :value="team.teamId || team.id"
                    >
                      {{ team.teamName }}
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                  >Nome da Campanha *</label
                >
                <div class="relative">
                  <Building2 class="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    v-model="campaignName"
                    type="text"
                    placeholder="Ex: Black Friday 2026, Lançamento Verão..."
                    class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent outline-none transition-all text-gray-900"
                    required
                    :disabled="isLoading"
                  />
                </div>
              </div>

              <DialogFooter class="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  @click="isCreateCampaignDialogOpen = false"
                  :disabled="isLoading"
                  class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="isLoading || !campaignName.trim() || !modalTeamId"
                  class="flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2 px-6 rounded-lg transition-all disabled:opacity-50 text-sm"
                >
                  <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
                  <Plus v-else class="w-4 h-4 mr-2" />
                  Criar Campanha
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <!-- Modal de Postagens da Campanha -->
        <Dialog v-model:open="isPostsDialogOpen">
          <DialogContent class="sm:max-w-xl">
            <DialogHeader>
              <div class="flex items-center justify-between pr-4">
                <DialogTitle class="text-gray-900 flex items-center text-base">
                  <FileText class="w-5 h-5 mr-2 text-vibrant-green" />
                  Postagens da Campanha
                </DialogTitle>
                <span
                  v-if="!isFetchingPosts && campaignPosts.length > 0"
                  class="text-xs px-2.5 py-0.5 rounded-full bg-soft-green/30 text-vibrant-green font-semibold"
                >
                  {{ campaignPosts.length }} {{ campaignPosts.length === 1 ? 'postagem' : 'postagens' }}
                </span>
              </div>
              <DialogDescription>
                Postagens vinculadas à campanha "{{ selectedCampaign?.name }}".
              </DialogDescription>
            </DialogHeader>

            <div class="mt-4">
              <div v-if="isFetchingPosts" class="flex flex-col items-center justify-center p-8 text-gray-500">
                <Loader2 class="w-7 h-7 text-vibrant-green animate-spin mb-2" />
                <span class="text-xs">Carregando postagens...</span>
              </div>

              <div
                v-else-if="campaignPosts.length === 0"
                class="text-center py-8 px-4 bg-gray-50 border border-dashed border-gray-200 rounded-xl"
              >
                <FolderOpen class="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p class="text-sm font-medium text-gray-700">Nenhuma postagem vinculada</p>
                <p class="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                  Crie postagens associadas a esta campanha para que apareçam aqui.
                </p>
              </div>

              <div v-else class="space-y-3 max-h-96 overflow-y-auto pr-1">
                <div
                  v-for="post in campaignPosts"
                  :key="post.postId"
                  class="p-3.5 bg-white border border-gray-200 hover:border-gray-300 rounded-xl shadow-xs transition-all flex items-start gap-3.5"
                >
                  <!-- Miniatura da Imagem -->
                  <div
                    v-if="getPostThumbnail(post.postId)"
                    class="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0 bg-gray-100 shadow-xs"
                  >
                    <img
                      :src="getPostThumbnail(post.postId)"
                      alt="Miniatura da postagem"
                      class="w-full h-full object-cover"
                    />
                  </div>
                  <div
                    v-else
                    class="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 flex flex-col items-center justify-center text-gray-400 flex-shrink-0"
                    title="Sem imagem pré-carregada"
                  >
                    <ImageIcon class="w-6 h-6 text-gray-400"
                    />
                    <span class="text-[9px] text-gray-400 mt-0.5">Sem foto</span>
                  </div>

                  <!-- Conteúdo / Legenda e Badges -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        :class="[
                          'px-2 py-0.5 text-xs rounded-full font-medium border',
                          getStatusBadgeClasses(post.status),
                        ]"
                      >
                        {{ formatStatus(post.status) }}
                      </span>

                      <span
                        v-if="getPostAssetsCount(post.postId) > 0"
                        class="inline-flex items-center text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200"
                      >
                        <Layers class="w-3 h-3 mr-1 text-gray-400" />
                        {{ getPostAssetsCount(post.postId) }} {{ getPostAssetsCount(post.postId) === 1 ? 'mídia' : 'mídias' }}
                      </span>

                      <span class="text-[11px] font-mono text-gray-400 ml-auto">
                        #{{ post.postId.slice(0, 8) }}
                      </span>
                    </div>

                    <p class="text-xs text-gray-800 whitespace-pre-line line-clamp-2 leading-relaxed">
                      {{ post.caption || "Postagem sem legenda." }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter class="mt-4">
              <button
                @click="isPostsDialogOpen = false"
                class="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                Fechar
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <!-- Modal de Sucesso -->
        <Dialog v-model:open="isSuccessDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle class="text-vibrant-green">Sucesso!</DialogTitle>
              <DialogDescription>
                A campanha foi cadastrada com sucesso.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                @click="isSuccessDialogOpen = false"
                class="w-full bg-vibrant-green text-white py-2 rounded-lg font-medium hover:bg-vibrant-green/90 transition-colors"
              >
                Continuar
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <!-- Modal de Erro -->
        <Dialog v-model:open="isErrorDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle class="text-red-600">Erro na Operação</DialogTitle>
              <DialogDescription>{{ errorMessage }}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                @click="isErrorDialogOpen = false"
                class="w-full bg-gray-100 hover:bg-gray-200 py-2 rounded-lg font-medium text-gray-900 transition-colors"
              >
                Fechar
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  </div>
</template>
