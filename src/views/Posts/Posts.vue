<script setup lang="ts">
import { ref, onMounted } from "vue";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import {
  ImagePlus,
  Loader2,
  Send,
  X,
  FileText,
  Paperclip,
  Download,
  Image as ImageIcon,
  Plus,
  Building2,
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

// ==========================================
// INTERFACES
// ==========================================
interface CampaignOption {
  campaignId: string;
  name: string;
  teamId: string;
  teamName: string;
}

// ==========================================
// ESTADO: Criação de Postagem
// ==========================================
const isCreatePostDialogOpen = ref(false);
const caption = ref("");
const selectedFiles = ref<File[]>([]);
const availableCampaigns = ref<CampaignOption[]>([]);
const selectedCampaignKey = ref("");
const isFetchingCampaigns = ref(false);
const isSubmitting = ref(false);
const statusMessage = ref("");
const errorMessage = ref("");
const isErrorDialogOpen = ref(false);
const isSuccessDialogOpen = ref(false);

// ==========================================
// ESTADO: Listagem de Postagens
// ==========================================
const posts = ref<any[]>([]);
const isFetching = ref(true);
const isAssetsDialogOpen = ref(false);
const selectedAssets = ref<any[]>([]);
const isDownloading = ref<Record<string, boolean>>({});

const getToken = () => localStorage.getItem("@MktApp:token");

// ==========================================
// MÉTODOS: Listagem e Download
// ==========================================
const fetchPosts = async () => {
  isFetching.value = true;
  try {
    const response = await apiFetch("/identity/users/me/posts", {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    if (!response.ok) throw new Error("Erro ao carregar postagens.");

    const data = await response.json();
    posts.value = Array.isArray(data)
      ? data
      : data.posts ||
        Object.values(data).filter(
          (item) => typeof item === "object" && item?.id,
        ) ||
        [];
  } catch (error: any) {
    showError(error.message);
  } finally {
    isFetching.value = false;
  }
};

const viewAssets = (assets: any[]) => {
  selectedAssets.value = assets || [];
  isAssetsDialogOpen.value = true;
};

const downloadAsset = async (mediaId: string, fileName: string) => {
  if (!mediaId) return;

  isDownloading.value[mediaId] = true;
  try {
    const response = await apiFetch(`/media/files/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    if (!response.ok) throw new Error("Falha ao baixar o arquivo.");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "download";
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    showError(error.message);
  } finally {
    isDownloading.value[mediaId] = false;
  }
};

const fetchUserCampaigns = async () => {
  isFetchingCampaigns.value = true;
  try {
    const teamsResponse = await apiFetch("/identity/users/me/teams");
    if (!teamsResponse.ok) return;

    const teamsData = await teamsResponse.json();
    const userTeams = teamsData.teams || [];

    const allCampaigns: CampaignOption[] = [];
    for (const team of userTeams) {
      const teamId = team.teamId || team.id;
      if (!teamId) continue;

      const campResponse = await apiFetch(`/workflow/teams/${teamId}/campaigns`);
      if (campResponse.ok) {
        const campData = await campResponse.json();
        const teamCampaigns = campData.campaigns || [];
        for (const camp of teamCampaigns) {
          allCampaigns.push({
            campaignId: camp.campaignId,
            name: camp.name,
            teamId: teamId,
            teamName: team.teamName,
          });
        }
      }
    }
    availableCampaigns.value = allCampaigns;
  } catch (error) {
    console.error("Erro ao carregar campanhas para postagens:", error);
  } finally {
    isFetchingCampaigns.value = false;
  }
};

const openCreatePostModal = () => {
  selectedCampaignKey.value = "";
  fetchUserCampaigns();
  isCreatePostDialogOpen.value = true;
};

// ==========================================
// MÉTODOS: Criação e Upload
// ==========================================
const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    selectedFiles.value = [...selectedFiles.value, ...Array.from(input.files)];
  }
  input.value = "";
};

const removeFile = (index: number) => {
  selectedFiles.value.splice(index, 1);
};

const handleSubmit = async () => {
  if (!caption.value) {
    showError("A legenda da postagem é obrigatória.");
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = "";

  try {
    // 1. Criar Postagem
    statusMessage.value = "Criando postagem...";
    const postResponse = await apiFetch("/media/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ caption: caption.value }),
    });

    if (!postResponse.ok) await throwApiError(postResponse);
    const rawPostId = await postResponse.text();
    const postId = rawPostId.replace(/^"|"$/g, "");

    // 2. Upload e Vínculo de Mídias
    if (selectedFiles.value.length > 0) {
      for (let i = 0; i < selectedFiles.value.length; i++) {
        const file = selectedFiles.value[i];
        statusMessage.value = `Enviando arquivo ${i + 1} de ${selectedFiles.value.length}...`;

        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await apiFetch("/media/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
          body: formData,
        });

        if (!uploadResponse.ok) await throwApiError(uploadResponse);
        const rawMediaId = await uploadResponse.text();
        const mediaId = rawMediaId.replace(/^"|"$/g, "");

        statusMessage.value = `Vinculando arquivo ${i + 1}...`;
        const linkResponse = await apiFetch(`/media/posts/${postId}/assets`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ mediaId: mediaId, sequenceOrder: i + 1 }),
        });

        if (!linkResponse.ok) await throwApiError(linkResponse);
      }
    }

    // 3. Vincular à Campanha (se selecionada)
    if (selectedCampaignKey.value) {
      const [teamId, campaignId] = selectedCampaignKey.value.split("|");
      if (teamId && campaignId) {
        statusMessage.value = "Vinculando postagem à campanha...";
        const campaignLinkResponse = await apiFetch(
          `/workflow/teams/${teamId}/campaigns/${campaignId}/posts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ postId: postId }),
          }
        );

        if (!campaignLinkResponse.ok) await throwApiError(campaignLinkResponse);
      }
    }

    isCreatePostDialogOpen.value = false;
    isSuccessDialogOpen.value = true;
    caption.value = "";
    selectedFiles.value = [];
    selectedCampaignKey.value = "";

    // Atualiza a tabela imediatamente sem que o usuário precise recarregar a página
    fetchPosts();
  } catch (error: any) {
    showError(error.message || "Falha na comunicação com o servidor.");
  } finally {
    isSubmitting.value = false;
    statusMessage.value = "";
  }
};

// ==========================================
// UTILITÁRIOS
// ==========================================
const formatDate = (dateString: string) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const throwApiError = async (response: Response) => {
  const rawText = await response.text();
  let apiMessage = "Erro interno no servidor.";
  if (rawText) {
    try {
      const errorData = JSON.parse(rawText);
      apiMessage =
        errorData.message || errorData.detail || errorData.title || rawText;
    } catch {
      apiMessage = rawText;
    }
  }
  throw new Error(apiMessage);
};

const showError = (msg: string) => {
  errorMessage.value = msg;
  isErrorDialogOpen.value = true;
};

// Bootstrap inicial
onMounted(() => {
  fetchPosts();
  fetchUserCampaigns();
});
</script>

<template>
  <div class="flex min-h-screen bg-gray-50">
    <AppSidebar />

    <main class="flex-1 overflow-auto">
      <div class="p-8">
        <div class="mb-8 max-w-4xl">
          <h1 class="text-2xl font-semibold text-gray-900 mb-2">Postagens</h1>
          <p class="text-gray-600">
            Crie publicações e acompanhe o seu histórico.
          </p>
        </div>

        <div
          class="max-w-4xl bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
        >
          <div
            class="p-6 border-b border-gray-200 flex justify-between items-center"
          >
            <h2 class="text-lg font-semibold text-gray-900">
              Histórico de Postagens
            </h2>
            <button
              type="button"
              @click="openCreatePostModal"
              class="flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2.5 px-4 rounded-lg transition-all shadow-sm text-sm"
            >
              <Plus class="w-4 h-4 mr-2" />
              Nova Postagem
            </button>
          </div>

          <div class="p-0">
            <div v-if="isFetching" class="flex justify-center p-8">
              <Loader2 class="w-6 h-6 text-vibrant-green animate-spin" />
            </div>

            <Table v-else>
              <TableHeader>
                <TableRow>
                  <TableHead>Legenda</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead class="text-right">Anexos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="posts.length === 0">
                  <TableCell colspan="4" class="text-center text-gray-500 py-8">
                    Nenhuma postagem encontrada.
                  </TableCell>
                </TableRow>
                <TableRow v-for="post in posts" :key="post.id">
                  <TableCell
                    class="font-medium text-gray-900 max-w-xs truncate"
                  >
                    {{ post.caption || "Sem legenda" }}
                  </TableCell>
                  <TableCell>
                    <span
                      class="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium"
                    >
                      {{ post.status || "Criado" }}
                    </span>
                  </TableCell>
                  <TableCell class="text-gray-500 text-sm">
                    {{ formatDate(post.createdAt) }}
                  </TableCell>
                  <TableCell class="text-right">
                    <button
                      v-if="post.assets && post.assets.length > 0"
                      @click="viewAssets(post.assets)"
                      class="inline-flex items-center text-sm text-vibrant-green hover:bg-soft-green/30 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-vibrant-green/20"
                    >
                      <Paperclip class="w-4 h-4 mr-1.5" />
                      {{ post.assets.length }}
                    </button>
                    <span v-else class="text-gray-400 text-sm mr-4">-</span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </main>

    <!-- Modal de Criação de Postagem -->
    <Dialog v-model:open="isCreatePostDialogOpen">
      <DialogContent class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="text-gray-900">Nova Postagem</DialogTitle>
          <DialogDescription>
            Crie uma nova publicação para suas redes sociais.
          </DialogDescription>
        </DialogHeader>

        <form @submit.prevent="handleSubmit" class="space-y-5 mt-2">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Vincular à Campanha (Opcional)
            </label>
            <div class="relative">
              <Building2 class="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <select
                v-model="selectedCampaignKey"
                class="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent outline-none transition-all text-gray-900 bg-white"
                :disabled="isSubmitting || isFetchingCampaigns"
              >
                <option value="">Nenhuma campanha</option>
                <option
                  v-for="camp in availableCampaigns"
                  :key="camp.campaignId"
                  :value="`${camp.teamId}|${camp.campaignId}`"
                >
                  {{ camp.name }} (Time: {{ camp.teamName }})
                </option>
              </select>
            </div>
            <div
              v-if="!isFetchingCampaigns && availableCampaigns.length === 0"
              class="mt-2 text-xs text-gray-500 flex items-center justify-between"
            >
              <span>Nenhuma campanha cadastrada. A postagem será criada como avulsa.</span>
              <router-link
                to="/campaigns"
                class="text-vibrant-green hover:underline font-medium ml-2"
              >
                Criar Campanha
              </router-link>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >Legenda da Publicação *</label
            >
            <textarea
              v-model="caption"
              rows="4"
              placeholder="O que você quer compartilhar hoje?"
              class="w-full p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent outline-none transition-all resize-none text-gray-900"
              :disabled="isSubmitting"
              required
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >Mídias (Opcional)</label
            >
            <div
              class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors"
            >
              <input
                type="file"
                id="modal-file-upload"
                multiple
                accept="image/*,video/*"
                class="hidden"
                @change="handleFileChange"
                :disabled="isSubmitting"
              />
              <label
                for="modal-file-upload"
                class="cursor-pointer flex flex-col items-center"
              >
                <div class="p-3 bg-soft-green/30 rounded-full mb-3">
                  <ImagePlus class="w-5 h-5 text-vibrant-green" />
                </div>
                <span class="text-sm font-medium text-gray-900"
                  >Clique para selecionar anexos</span
                >
              </label>
            </div>

            <div
              v-if="selectedFiles.length > 0"
              class="mt-4 space-y-2 max-h-40 overflow-y-auto pr-2"
            >
              <div
                v-for="(file, index) in selectedFiles"
                :key="index"
                class="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <div class="flex items-center truncate">
                  <ImagePlus class="w-4 h-4 mr-3 text-gray-500 flex-shrink-0" />
                  <span class="text-sm text-gray-700 truncate">{{
                    file.name
                  }}</span>
                </div>
                <button
                  type="button"
                  @click="removeFile(index)"
                  :disabled="isSubmitting"
                  class="text-gray-400 hover:text-red-500 transition-colors p-1"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div
            class="flex items-center justify-between pt-4 border-t border-gray-100"
          >
            <span class="text-sm font-medium text-vibrant-green animate-pulse">
              {{ isSubmitting ? statusMessage : "" }}
            </span>
            <div class="flex items-center gap-3">
              <button
                type="button"
                @click="isCreatePostDialogOpen = false"
                :disabled="isSubmitting"
                class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="isSubmitting || !caption"
                class="flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2 px-6 rounded-lg transition-all disabled:opacity-50 text-sm"
              >
                <Loader2
                  v-if="isSubmitting"
                  class="w-4 h-4 mr-2 animate-spin"
                />
                <Send v-else class="w-4 h-4 mr-2" />
                Publicar
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="isAssetsDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-gray-900 flex items-center">
            <ImageIcon class="w-5 h-5 mr-2 text-vibrant-green" />
            Anexos da Postagem
          </DialogTitle>
          <DialogDescription>
            Arquivos vinculados a esta publicação.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 mt-4 max-h-72 overflow-y-auto pr-2">
          <div
            v-for="asset in selectedAssets"
            :key="asset.media.id"
            class="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
          >
            <div class="flex items-center truncate mr-4">
              <FileText class="w-4 h-4 mr-3 text-gray-500 flex-shrink-0" />
              <span
                class="text-sm text-gray-700 truncate"
                :title="asset.media.fileName"
              >
                {{ asset.media.fileName }}
              </span>
            </div>

            <button
              @click="downloadAsset(asset.media.id, asset.media.fileName)"
              :disabled="isDownloading[asset.media.id]"
              class="flex items-center justify-center text-gray-600 hover:text-vibrant-green transition-colors p-2 rounded hover:bg-gray-200 disabled:opacity-50"
              title="Baixar Arquivo"
            >
              <Loader2
                v-if="isDownloading[asset.media.id]"
                class="w-4 h-4 animate-spin"
              />
              <Download v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <DialogFooter class="mt-4">
          <button
            @click="isAssetsDialogOpen = false"
            class="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 rounded-lg font-medium transition-colors"
          >
            Fechar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="isSuccessDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-vibrant-green">Postagem Criada!</DialogTitle>
          <DialogDescription
            >Sua postagem e mídias foram processadas com
            sucesso.</DialogDescription
          >
        </DialogHeader>
        <DialogFooter>
          <button
            @click="isSuccessDialogOpen = false"
            class="w-full bg-vibrant-green hover:bg-vibrant-green/90 text-white py-2 rounded-lg transition-colors"
          >
            Continuar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="isErrorDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-red-600">Erro na Operação</DialogTitle>
          <DialogDescription>{{ errorMessage }}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            @click="isErrorDialogOpen = false"
            class="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
