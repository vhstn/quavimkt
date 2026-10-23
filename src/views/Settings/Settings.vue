<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import {
  Settings,
  Instagram,
  RefreshCw,
  Trash2,
  ExternalLink,
  Shield,
  Crown,
  User,
  Clock,
  Key,
  Building2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  HelpCircle,
} from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";

interface UserTeam {
  teamId: string;
  id?: string;
  teamName: string;
  role: string;
}

interface InstagramAccount {
  instagramUserId: string;
  username: string;
  connectedAt: string;
  updatedAt: string;
}

interface InstagramConnection {
  isConfigured: boolean;
  account: InstagramAccount | null;
}

const teams = ref<UserTeam[]>([]);
const selectedTeamId = ref("");
const isFetchingTeams = ref(true);

const instagramConnection = ref<InstagramConnection | null>(null);
const isFetchingInstagram = ref(false);

const isConnectDialogOpen = ref(false);
const accessToken = ref("");
const showAccessToken = ref(false);
const isConnecting = ref(false);

const isDisconnectDialogOpen = ref(false);
const isDisconnecting = ref(false);

const isSuccessDialogOpen = ref(false);
const successTitle = ref("Sucesso!");
const successMessage = ref("");

const isErrorDialogOpen = ref(false);
const errorMessage = ref("");

const selectedTeam = computed(() => {
  return teams.value.find(
    (t) => (t.teamId || t.id) === selectedTeamId.value
  );
});

const isManagerOfSelectedTeam = computed(() => {
  if (!selectedTeam.value) return false;
  const role = selectedTeam.value.role?.toLowerCase();
  return role === "owner" || role === "administrator";
});

const formatRole = (role?: string) => {
  if (!role) return "Membro";
  const normalized = role.toLowerCase();
  switch (normalized) {
    case "owner":
      return "Dono";
    case "administrator":
      return "Administrador";
    case "member":
      return "Membro";
    default:
      return role;
  }
};

const getRoleBadgeClasses = (role?: string) => {
  if (!role) return "bg-gray-100 text-gray-700 border-gray-200";
  const normalized = role.toLowerCase();
  switch (normalized) {
    case "owner":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "administrator":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "member":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateStr;
  }
};

const showSuccess = (message: string, title = "Sucesso!") => {
  successTitle.value = title;
  successMessage.value = message;
  isSuccessDialogOpen.value = true;
};

const showError = (message: string) => {
  errorMessage.value = message;
  isErrorDialogOpen.value = true;
};

const parseErrorMessage = async (response: Response, defaultMessage: string) => {
  try {
    const raw = await response.text();
    if (!raw) return defaultMessage;
    const data = JSON.parse(raw);
    return data.detail || data.message || data.title || raw;
  } catch {
    return defaultMessage;
  }
};

const fetchTeams = async () => {
  isFetchingTeams.value = true;
  try {
    const response = await apiFetch("/identity/users/me/teams");
    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao carregar times."));
    }
    const data = await response.json();
    teams.value = data.teams || [];

    if (teams.value.length > 0) {
      const firstTeam = teams.value[0];
      const initialId = firstTeam.teamId || firstTeam.id || "";
      selectedTeamId.value = initialId;
      await fetchInstagramStatus(initialId);
    }
  } catch (error: any) {
    showError(error.message || "Falha ao conectar com o servidor.");
  } finally {
    isFetchingTeams.value = false;
  }
};

const fetchInstagramStatus = async (teamId: string) => {
  if (!teamId) {
    instagramConnection.value = null;
    return;
  }

  isFetchingInstagram.value = true;
  try {
    const response = await apiFetch(`/teams/${teamId}/social/instagram`);
    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao consultar conta do Instagram."));
    }
    const data: InstagramConnection = await response.json();
    instagramConnection.value = data;
  } catch (error: any) {
    showError(error.message || "Falha ao carregar status do Instagram.");
  } finally {
    isFetchingInstagram.value = false;
  }
};

const handleTeamChange = async () => {
  if (selectedTeamId.value) {
    await fetchInstagramStatus(selectedTeamId.value);
  }
};

const openConnectModal = () => {
  accessToken.value = "";
  showAccessToken.value = false;
  isConnectDialogOpen.value = true;
};

const handleConnectInstagram = async () => {
  if (!selectedTeamId.value) return;

  const token = accessToken.value.trim();
  if (!token) {
    showError("Por favor, informe o token de acesso do Instagram.");
    return;
  }

  isConnecting.value = true;
  try {
    const response = await apiFetch(`/teams/${selectedTeamId.value}/social/instagram`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accessToken: token }),
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao conectar conta do Instagram."));
    }

    const data: InstagramAccount = await response.json();
    isConnectDialogOpen.value = false;
    accessToken.value = "";
    showSuccess(
      `A conta @${data.username} foi conectada com sucesso ao time "${selectedTeam.value?.teamName}"!`,
      "Conta Conectada"
    );
    await fetchInstagramStatus(selectedTeamId.value);
  } catch (error: any) {
    showError(error.message || "Falha ao configurar conta do Instagram.");
  } finally {
    isConnecting.value = false;
  }
};

const openDisconnectModal = () => {
  isDisconnectDialogOpen.value = true;
};

const handleDisconnectInstagram = async () => {
  if (!selectedTeamId.value) return;

  isDisconnecting.value = true;
  try {
    const response = await apiFetch(`/teams/${selectedTeamId.value}/social/instagram`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao desconectar conta do Instagram."));
    }

    isDisconnectDialogOpen.value = false;
    showSuccess(
      `A conta do Instagram foi desconectada do time "${selectedTeam.value?.teamName}".`,
      "Conta Desconectada"
    );
    await fetchInstagramStatus(selectedTeamId.value);
  } catch (error: any) {
    showError(error.message || "Falha ao desconectar conta do Instagram.");
  } finally {
    isDisconnecting.value = false;
  }
};

onMounted(() => {
  fetchTeams();
});
</script>

<template>
  <div class="flex min-h-screen bg-gray-50">
    <AppSidebar />

    <main class="flex-1 overflow-auto">
      <div class="p-8 max-w-5xl">
        <!-- Cabeçalho -->
        <div class="mb-8">
          <div class="flex items-center space-x-3 mb-2">
            <div class="p-2 bg-gray-100 rounded-lg text-gray-700">
              <Settings class="w-6 h-6 text-gray-700" />
            </div>
            <div>
              <h1 class="text-2xl font-semibold text-gray-900">
                Configurações
              </h1>
              <p class="text-gray-600 text-sm">
                Gerencie as integrações e configurações das suas equipes.
              </p>
            </div>
          </div>
        </div>

        <!-- Seletor de Time -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <label class="block text-sm font-semibold text-gray-900 mb-1">
                Equipe Ativa
              </label>
              <p class="text-xs text-gray-500">
                Selecione a equipe cujas integrações você deseja visualizar ou gerenciar.
              </p>
            </div>

            <div class="flex items-center space-x-3">
              <div v-if="isFetchingTeams" class="flex items-center text-sm text-gray-500">
                <Loader2 class="w-4 h-4 mr-2 animate-spin text-vibrant-green" />
                Carregando times...
              </div>

              <div v-else-if="teams.length > 0" class="flex items-center space-x-3">
                <div class="relative min-w-[240px]">
                  <Building2 class="absolute left-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                  <select
                    v-model="selectedTeamId"
                    @change="handleTeamChange"
                    class="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-vibrant-green focus:border-transparent outline-none transition-all cursor-pointer"
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

                <span
                  v-if="selectedTeam"
                  :class="[
                    'inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border',
                    getRoleBadgeClasses(selectedTeam.role),
                  ]"
                >
                  <Crown v-if="selectedTeam.role === 'owner'" class="w-3.5 h-3.5 mr-1" />
                  <Shield v-else-if="selectedTeam.role === 'administrator'" class="w-3.5 h-3.5 mr-1" />
                  <User v-else class="w-3.5 h-3.5 mr-1" />
                  {{ formatRole(selectedTeam.role) }}
                </span>
              </div>

              <div v-else class="text-sm text-gray-500">
                Você não participa de nenhuma equipe.
              </div>
            </div>
          </div>
        </div>

        <!-- Seção: Nenhuma Equipe Cadastrada -->
        <div
          v-if="!isFetchingTeams && teams.length === 0"
          class="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center"
        >
          <Building2 class="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 class="text-lg font-semibold text-gray-900 mb-1">
            Nenhuma equipe encontrada
          </h2>
          <p class="text-gray-500 text-sm max-w-md mx-auto mb-6">
            Para gerenciar conexões do Instagram, você precisa pertencer a pelo menos um time.
          </p>
          <router-link
            to="/teams"
            class="inline-flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2.5 px-5 rounded-lg text-sm transition-all shadow-sm"
          >
            Ir para Gestão de Times
          </router-link>
        </div>

        <!-- Seção: Card de Integração com o Instagram -->
        <div
          v-else
          class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
        >
          <!-- Cabeçalho do Card com Gradiente do Instagram -->
          <div class="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center space-x-4">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                <Instagram class="w-6 h-6" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-lg font-semibold text-gray-900">
                    Instagram Graph API
                  </h2>
                  <span
                    v-if="instagramConnection?.isConfigured"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200"
                  >
                    <CheckCircle2 class="w-3 h-3 mr-1" />
                    Conectado
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200"
                  >
                    Não configurado
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-0.5">
                  Conexão oficial com a Meta para publicação automática de posts e stories.
                </p>
              </div>
            </div>

            <!-- Botões de Ação do Cabeçalho -->
            <div v-if="!isFetchingInstagram && selectedTeam" class="flex items-center gap-2">
              <template v-if="instagramConnection?.isConfigured">
                <button
                  v-if="isManagerOfSelectedTeam"
                  type="button"
                  @click="openConnectModal"
                  class="inline-flex items-center px-3 py-2 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                  title="Atualizar token da Meta"
                >
                  <RefreshCw class="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                  Renovar Token
                </button>
                <button
                  v-if="isManagerOfSelectedTeam"
                  type="button"
                  @click="openDisconnectModal"
                  class="inline-flex items-center px-3 py-2 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors shadow-sm"
                >
                  <Trash2 class="w-3.5 h-3.5 mr-1.5" />
                  Desconectar
                </button>
              </template>
              <template v-else>
                <button
                  v-if="isManagerOfSelectedTeam"
                  type="button"
                  @click="openConnectModal"
                  class="inline-flex items-center px-4 py-2 rounded-lg text-xs font-medium bg-vibrant-green hover:bg-vibrant-green/90 text-white transition-colors shadow-sm"
                >
                  <Instagram class="w-3.5 h-3.5 mr-1.5" />
                  Conectar Instagram
                </button>
              </template>
            </div>
          </div>

          <!-- Conteúdo: Loading -->
          <div v-if="isFetchingInstagram" class="p-12 flex justify-center">
            <Loader2 class="w-8 h-8 text-vibrant-green animate-spin" />
          </div>

          <!-- Conteúdo: Conta Conectada -->
          <div
            v-else-if="instagramConnection?.isConfigured && instagramConnection.account"
            class="p-6 space-y-6"
          >
            <!-- Bloco de Perfil Conectado -->
            <div class="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50/60 to-pink-50/60 rounded-xl border border-purple-100">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-full bg-white border border-purple-200 flex items-center justify-center text-purple-600 font-bold text-sm shadow-sm">
                  @
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-base font-bold text-gray-900">
                      @{{ instagramConnection.account.username }}
                    </span>
                    <a
                      :href="`https://instagram.com/${instagramConnection.account.username}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-gray-400 hover:text-purple-600 transition-colors"
                      title="Ver perfil no Instagram"
                    >
                      <ExternalLink class="w-4 h-4" />
                    </a>
                  </div>
                  <span class="text-xs text-gray-500">
                    Conta Profissional conectada ao time {{ selectedTeam?.teamName }}
                  </span>
                </div>
              </div>

              <div class="text-right hidden sm:block">
                <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Conta Pronta para Publicações
                </span>
              </div>
            </div>

            <!-- Grade de Detalhes -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div class="text-xs text-gray-500 font-medium mb-1">
                  ID da Conta (Instagram User ID)
                </div>
                <div class="text-sm font-semibold text-gray-800 font-mono">
                  {{ instagramConnection.account.instagramUserId }}
                </div>
              </div>

              <div class="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div class="text-xs text-gray-500 font-medium mb-1">
                  Conectada em
                </div>
                <div class="text-sm font-semibold text-gray-800 flex items-center gap-1">
                  <Clock class="w-3.5 h-3.5 text-gray-400" />
                  {{ formatDate(instagramConnection.account.connectedAt) }}
                </div>
              </div>

              <div class="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div class="text-xs text-gray-500 font-medium mb-1">
                  Última Atualização do Token
                </div>
                <div class="text-sm font-semibold text-gray-800 flex items-center gap-1">
                  <Key class="w-3.5 h-3.5 text-gray-400" />
                  {{ formatDate(instagramConnection.account.updatedAt) }}
                </div>
              </div>
            </div>

            <!-- Informação sobre validade do token -->
            <div class="p-4 bg-blue-50/70 border border-blue-100 rounded-lg flex items-start space-x-3 text-xs text-blue-900">
              <HelpCircle class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p class="font-medium mb-0.5">Validade do Token de Acesso da Meta</p>
                <p class="text-blue-700 leading-relaxed">
                  Os tokens de acesso da Meta expiram aproximadamente a cada 60 dias. Quando o token expirar ou for revogado, renove a conexão utilizando o botão "Renovar Token" para garantir a continuidade do agendamento de posts.
                </p>
              </div>
            </div>

            <!-- Aviso para membros comuns -->
            <div
              v-if="!isManagerOfSelectedTeam"
              class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center space-x-2"
            >
              <AlertCircle class="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                Você possui papel de <strong>Membro</strong> nesta equipe. Apenas o Dono e os Administradores podem alterar ou desconectar a conta do Instagram.
              </span>
            </div>
          </div>

          <!-- Conteúdo: Nenhuma Conta Conectada -->
          <div v-else class="p-8 text-center space-y-6">
            <div class="max-w-md mx-auto">
              <div class="w-16 h-16 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 mx-auto mb-4">
                <Instagram class="w-8 h-8" />
              </div>
              <h3 class="text-base font-semibold text-gray-900 mb-1">
                Conecte a conta do Instagram para este time
              </h3>
              <p class="text-sm text-gray-500 leading-relaxed">
                Integre a conta profissional do seu time para publicar postagens e stories diretamente através da plataforma.
              </p>
            </div>

            <!-- Passo a passo explicativo -->
            <div class="max-w-xl mx-auto bg-gray-50 rounded-xl p-5 border border-gray-200/80 text-left space-y-3">
              <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                Como funciona a integração:
              </h4>

              <div class="flex items-start space-x-3">
                <span class="w-5 h-5 rounded-full bg-vibrant-green text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  1
                </span>
                <p class="text-xs text-gray-700 leading-relaxed">
                  Certifique-se de que a conta do Instagram seja <strong>Business</strong> ou <strong>Creator</strong> (contas pessoais não são aceitas pela API da Meta).
                </p>
              </div>

              <div class="flex items-start space-x-3">
                <span class="w-5 h-5 rounded-full bg-vibrant-green text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  2
                </span>
                <p class="text-xs text-gray-700 leading-relaxed">
                  No painel da <strong>Meta for Developers</strong> (Instagram Graph API), gere o <strong>Token de Acesso</strong> para a conta desejada.
                </p>
              </div>

              <div class="flex items-start space-x-3">
                <span class="w-5 h-5 rounded-full bg-vibrant-green text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  3
                </span>
                <p class="text-xs text-gray-700 leading-relaxed">
                  Clique no botão abaixo, cole o token de acesso e confirme. O sistema validará as credenciais na Meta e salvará a conexão cifrada.
                </p>
              </div>
            </div>

            <!-- Botão de Ação -->
            <div class="pt-2">
              <button
                v-if="isManagerOfSelectedTeam"
                type="button"
                @click="openConnectModal"
                class="inline-flex items-center px-6 py-2.5 rounded-lg text-sm font-medium bg-vibrant-green hover:bg-vibrant-green/90 text-white transition-colors shadow-sm"
              >
                <Instagram class="w-4 h-4 mr-2" />
                Conectar Conta do Instagram
              </button>

              <div
                v-else
                class="max-w-md mx-auto p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-center space-x-2"
              >
                <AlertCircle class="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  Apenas o <strong>Dono</strong> e os <strong>Administradores</strong> deste time podem conectar a conta do Instagram.
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================== -->
        <!-- MODAL: CONECTAR / ATUALIZAR CONTA          -->
        <!-- ========================================== -->
        <Dialog v-model:open="isConnectDialogOpen">
          <DialogContent class="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle class="text-gray-900 flex items-center gap-2">
                <Instagram class="w-5 h-5 text-rose-500" />
                {{ instagramConnection?.isConfigured ? 'Atualizar Token do Instagram' : 'Conectar Conta do Instagram' }}
              </DialogTitle>
              <DialogDescription>
                Informe o token de acesso da Meta para o time
                <strong class="text-gray-900">{{ selectedTeam?.teamName }}</strong>.
              </DialogDescription>
            </DialogHeader>

            <form @submit.prevent="handleConnectInstagram" class="space-y-4 mt-2">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Token de Acesso da Meta *
                </label>
                <div class="relative">
                  <textarea
                    v-model="accessToken"
                    rows="4"
                    placeholder="Cole aqui o token de acesso gerado no painel da Meta..."
                    class="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent outline-none transition-all text-xs font-mono resize-none text-gray-900 bg-gray-50/50"
                    required
                    :disabled="isConnecting"
                  ></textarea>
                </div>
                <div class="mt-2 text-xs text-gray-500 flex items-start space-x-1.5">
                  <Shield class="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span>
                    O token é validado na Meta e armazenado de forma cifrada no servidor. Ele nunca é retornado pela API.
                  </span>
                </div>
              </div>

              <div class="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600 space-y-1">
                <p class="font-semibold text-gray-700">Requisitos da Conta:</p>
                <p>• A conta do Instagram deve ser <strong>Profissional</strong> (Business ou Creator).</p>
                <p>• O token deve possuir permissões para <code>instagram_basic</code> e <code>instagram_content_publish</code>.</p>
              </div>

              <DialogFooter class="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  @click="isConnectDialogOpen = false"
                  :disabled="isConnecting"
                  class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="isConnecting || !accessToken.trim()"
                  class="flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2 px-6 rounded-lg transition-all disabled:opacity-50 text-sm shadow-sm"
                >
                  <Loader2 v-if="isConnecting" class="w-4 h-4 mr-2 animate-spin" />
                  <Instagram v-else class="w-4 h-4 mr-2" />
                  {{ instagramConnection?.isConfigured ? 'Atualizar Conexão' : 'Conectar Conta' }}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <!-- ========================================== -->
        <!-- MODAL: CONFIRMAR DESCONEXÃO                -->
        <!-- ========================================== -->
        <Dialog v-model:open="isDisconnectDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle class="text-red-600 flex items-center gap-2">
                <Trash2 class="w-5 h-5" />
                Desconectar Instagram
              </DialogTitle>
              <DialogDescription class="leading-relaxed">
                Tem certeza de que deseja desconectar a conta
                <strong class="text-gray-900">@{{ instagramConnection?.account?.username }}</strong>
                do time <strong class="text-gray-900">{{ selectedTeam?.teamName }}</strong>?
              </DialogDescription>
            </DialogHeader>

            <div class="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-800 space-y-1">
              <p class="font-medium">Atenção:</p>
              <p>• O token armazenado será excluído do servidor.</p>
              <p>• Publicações já realizadas no Instagram não serão afetadas.</p>
              <p>• Novas publicações não poderão ser solicitadas até que uma nova conta seja configurada.</p>
            </div>

            <DialogFooter class="flex justify-end gap-3 pt-3">
              <button
                type="button"
                @click="isDisconnectDialogOpen = false"
                :disabled="isDisconnecting"
                class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                @click="handleDisconnectInstagram"
                :disabled="isDisconnecting"
                class="flex items-center bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-5 rounded-lg transition-all disabled:opacity-50 text-sm shadow-sm"
              >
                <Loader2 v-if="isDisconnecting" class="w-4 h-4 mr-2 animate-spin" />
                <Trash2 v-else class="w-4 h-4 mr-2" />
                Confirmar Desconexão
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <!-- ========================================== -->
        <!-- MODAL: SUCESSO                             -->
        <!-- ========================================== -->
        <Dialog v-model:open="isSuccessDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle class="text-vibrant-green">{{ successTitle }}</DialogTitle>
              <DialogDescription>
                {{ successMessage }}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                @click="isSuccessDialogOpen = false"
                class="w-full bg-vibrant-green hover:bg-vibrant-green/90 text-white py-2 rounded-lg transition-colors font-medium text-sm"
              >
                Continuar
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <!-- ========================================== -->
        <!-- MODAL: ERRO                                -->
        <!-- ========================================== -->
        <Dialog v-model:open="isErrorDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle class="text-red-600">Erro na Operação</DialogTitle>
              <DialogDescription class="whitespace-pre-line">{{ errorMessage }}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                @click="isErrorDialogOpen = false"
                class="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 rounded-lg transition-colors font-medium text-sm"
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
