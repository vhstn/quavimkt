<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import {
  FileText,
  Share2,
  Building2,
  Clock,
  Plus,
  BarChart3,
  Users,
  Instagram,
  ExternalLink,
  RefreshCw,
  Mail,
  Check,
  X,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Sparkles,
} from "lucide-vue-next";
import { apiFetch } from "@/lib/api";

const router = useRouter();

// ==========================================
// INTERFACES
// ==========================================
interface UserProfile {
  id: string;
  fullName: string;
  email: string;
}

interface UserTeam {
  teamId: string;
  id?: string;
  teamName: string;
  name?: string;
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

interface UserInvitation {
  id: string;
  teamId: string;
  teamName: string;
  role: string;
  invitedByName: string;
  expiresAt: string;
}

interface PublicationSummary {
  id: string;
  postId: string;
  caption: string;
  format: "feed" | "story" | number;
  status: string;
  scheduledFor: string;
  requestedByName: string;
  requestedAt: string;
  publishedAt?: string | null;
}

interface TeamCampaign {
  campaignId: string;
  name: string;
  status?: string;
}

// ==========================================
// ESTADO
// ==========================================
const userProfile = ref<UserProfile | null>(null);
const teams = ref<UserTeam[]>([]);
const selectedTeamId = ref<string>("");
const instagramConnection = ref<InstagramConnection | null>(null);
const pendingInvitations = ref<UserInvitation[]>([]);

// Contadores e Listas
const postsCount = ref<number>(0);
const publications = ref<PublicationSummary[]>([]);
const campaigns = ref<TeamCampaign[]>([]);

// Estados de Carregamento
const isLoadingProfile = ref<boolean>(true);
const isLoadingTeams = ref<boolean>(true);
const isLoadingData = ref<boolean>(false);
const isRefreshing = ref<boolean>(false);
const isProcessingInvitation = ref<string | null>(null);

const errorMessage = ref<string>("");

// ==========================================
// COMPUTED PROPERTIES
// ==========================================
const currentTeam = computed(() =>
  teams.value.find((t) => t.teamId === selectedTeamId.value)
);

const isInstagramConnected = computed(
  () => instagramConnection.value?.isConfigured === true
);

// Contagem de Publicações Ativas/Agendadas
const scheduledPublicationsCount = computed(() => {
  return publications.value.filter((p) => {
    const s = String(p.status).toLowerCase();
    return s === "approved" || s === "pendingapproval" || s === "publishing";
  }).length;
});

// Contagem de Aprovações Pendentes
const pendingApprovalsCount = computed(() => {
  return publications.value.filter(
    (p) => String(p.status).toLowerCase() === "pendingapproval"
  ).length;
});

// 5 Publicações mais recentes do time
const recentPublications = computed(() => {
  return publications.value.slice(0, 5);
});

// ==========================================
// FORMATAÇÃO
// ==========================================
const formatDate = (isoString?: string | null): string => {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getRoleBadge = (role?: string) => {
  const r = role?.toLowerCase() || "";
  if (r === "owner" || r === "dono") {
    return { text: "Dono", class: "bg-purple-100 text-purple-800 border-purple-200" };
  }
  if (r === "admin" || r === "administrador") {
    return { text: "Administrador", class: "bg-blue-100 text-blue-800 border-blue-200" };
  }
  return { text: "Membro", class: "bg-gray-100 text-gray-700 border-gray-200" };
};

const getPublicationStatusBadge = (status: string) => {
  const s = String(status).toLowerCase();
  switch (s) {
    case "published":
      return { text: "Publicado", class: "bg-green-100 text-green-800 border-green-200" };
    case "approved":
      return { text: "Aprovado", class: "bg-blue-100 text-blue-800 border-blue-200" };
    case "pendingapproval":
      return { text: "Pendente", class: "bg-amber-100 text-amber-800 border-amber-200" };
    case "rejected":
      return { text: "Recusado", class: "bg-red-100 text-red-800 border-red-200" };
    case "failed":
      return { text: "Falhou", class: "bg-red-100 text-red-800 border-red-200" };
    case "canceled":
      return { text: "Cancelado", class: "bg-gray-100 text-gray-800 border-gray-200" };
    default:
      return { text: status, class: "bg-gray-100 text-gray-700 border-gray-200" };
  }
};

const formatFormatLabel = (fmt: "feed" | "story" | number): string => {
  if (fmt === "feed" || fmt === 1) return "Feed";
  if (fmt === "story" || fmt === 2) return "Story";
  return String(fmt);
};

// ==========================================
// INTEGRAÇÃO COM BACKEND
// ==========================================
const parseErrorMessage = async (response: Response, defaultMessage: string): Promise<string> => {
  try {
    const errorData = await response.json();
    if (errorData?.detail) return errorData.detail;
    if (errorData?.message) return errorData.message;
    if (errorData?.title) return errorData.title;
  } catch {
    // fallback
  }
  return defaultMessage;
};

// 1. Perfil do Usuário
const fetchUserProfile = async () => {
  isLoadingProfile.value = true;
  try {
    const response = await apiFetch("/identity/users/me");
    if (response.ok) {
      userProfile.value = await response.json();
    }
  } catch {
    // fallback se falhar
  } finally {
    isLoadingProfile.value = false;
  }
};

// 2. Convites Pendentes do Usuário
const fetchPendingInvitations = async () => {
  try {
    const response = await apiFetch("/identity/users/me/invitations");
    if (response.ok) {
      const data = await response.json();
      pendingInvitations.value = Array.isArray(data) ? data : data.invitations || [];
    }
  } catch {
    pendingInvitations.value = [];
  }
};

// 3. Aceitar Convite
const handleAcceptInvitation = async (invitationId: string) => {
  isProcessingInvitation.value = invitationId;
  try {
    const response = await apiFetch(`/identity/invitations/${invitationId}/accept`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao aceitar convite."));
    }
    await Promise.all([fetchPendingInvitations(), fetchTeams()]);
  } catch (err: any) {
    errorMessage.value = err.message || "Falha ao aceitar convite.";
  } finally {
    isProcessingInvitation.value = null;
  }
};

// 4. Recusar Convite
const handleDeclineInvitation = async (invitationId: string) => {
  isProcessingInvitation.value = invitationId;
  try {
    const response = await apiFetch(`/identity/invitations/${invitationId}/decline`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao recusar convite."));
    }
    await fetchPendingInvitations();
  } catch (err: any) {
    errorMessage.value = err.message || "Falha ao recusar convite.";
  } finally {
    isProcessingInvitation.value = null;
  }
};

// 5. Total de Posts no Acervo
const fetchPostsCount = async () => {
  try {
    const response = await apiFetch("/identity/users/me/posts?page=1&pageSize=1");
    if (response.ok) {
      const data = await response.json();
      postsCount.value = typeof data.totalCount === "number" ? data.totalCount : (data.items?.length || 0);
    }
  } catch {
    postsCount.value = 0;
  }
};

// 6. Equipes do Usuário
const fetchTeams = async () => {
  isLoadingTeams.value = true;
  try {
    const response = await apiFetch("/identity/users/me/teams");
    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao carregar equipes."));
    }
    const data = await response.json();
    const rawTeams = data.teams || (Array.isArray(data) ? data : []);
    teams.value = rawTeams.map((t: any) => ({
      teamId: t.teamId || t.id,
      id: t.id || t.teamId,
      teamName: t.teamName || t.name || "Time sem nome",
      name: t.teamName || t.name || "Time sem nome",
      role: t.role || "Membro",
    }));

    if (teams.value.length > 0) {
      const savedTeamId = localStorage.getItem("@MktApp:selectedTeamId");
      const matched = teams.value.find((t) => t.teamId === savedTeamId);
      const initialId = matched ? matched.teamId : teams.value[0].teamId;
      selectedTeamId.value = initialId;
      await loadTeamData(initialId);
    } else {
      selectedTeamId.value = "";
    }
  } catch (err: any) {
    errorMessage.value = err.message || "Erro ao conectar ao servidor.";
  } finally {
    isLoadingTeams.value = false;
  }
};

// 7. Dados do Time Ativo (Instagram, Publicações, Campanhas)
const loadTeamData = async (teamId: string) => {
  if (!teamId) return;
  isLoadingData.value = true;
  localStorage.setItem("@MktApp:selectedTeamId", teamId);

  try {
    await Promise.all([
      fetchInstagramStatus(teamId),
      fetchTeamPublications(teamId),
      fetchTeamCampaigns(teamId),
    ]);
  } finally {
    isLoadingData.value = false;
  }
};

const fetchInstagramStatus = async (teamId: string) => {
  try {
    const response = await apiFetch(`/teams/${teamId}/social/instagram`);
    if (response.ok) {
      instagramConnection.value = await response.json();
    } else {
      instagramConnection.value = { isConfigured: false, account: null };
    }
  } catch {
    instagramConnection.value = { isConfigured: false, account: null };
  }
};

const fetchTeamPublications = async (teamId: string) => {
  try {
    const response = await apiFetch(`/teams/${teamId}/social/instagram/publications?pageSize=20`);
    if (response.ok) {
      const data = await response.json();
      publications.value = data.items || data.publications || (Array.isArray(data) ? data : []);
    } else {
      publications.value = [];
    }
  } catch {
    publications.value = [];
  }
};

const fetchTeamCampaigns = async (teamId: string) => {
  try {
    const response = await apiFetch(`/workflow/teams/${teamId}/campaigns`);
    if (response.ok) {
      const data = await response.json();
      const raw = data.campaigns || (Array.isArray(data) ? data : []);
      campaigns.value = raw.map((c: any) => ({
        campaignId: c.campaignId || c.id,
        name: c.name || c.campaignName || "Campanha sem nome",
        status: c.status,
      }));
    } else {
      campaigns.value = [];
    }
  } catch {
    campaigns.value = [];
  }
};

const handleRefresh = async () => {
  isRefreshing.value = true;
  try {
    await Promise.all([
      fetchUserProfile(),
      fetchPendingInvitations(),
      fetchPostsCount(),
      selectedTeamId.value ? loadTeamData(selectedTeamId.value) : Promise.resolve(),
    ]);
  } finally {
    isRefreshing.value = false;
  }
};

// ==========================================
// WATCHERS & CICLO DE VIDA
// ==========================================
watch(selectedTeamId, async (newTeamId) => {
  if (newTeamId) {
    await loadTeamData(newTeamId);
  }
});

onMounted(async () => {
  await Promise.all([
    fetchUserProfile(),
    fetchPendingInvitations(),
    fetchPostsCount(),
    fetchTeams(),
  ]);
});
</script>

<template>
  <div class="flex min-h-screen bg-gray-50">
    <AppSidebar />

    <div class="flex-1 overflow-auto">
      <div class="p-8 max-w-7xl mx-auto space-y-6">

        <!-- ========================================== -->
        <!-- CABEÇALHO COM BOAS-VINDAS & TIME ATIVO -->
        <!-- ========================================== -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 class="text-2xl font-bold text-gray-900 mb-1 flex items-center space-x-2">
                <span>Bem-vindo de volta{{ userProfile?.fullName ? `, ${userProfile.fullName}` : '' }}!</span>
              </h1>
              <p class="text-sm text-gray-600">
                Acompanhe o ritmo de produção, aprovações e desempenho operacional do seu marketing
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <!-- Seletor de Equipe -->
              <div class="flex items-center space-x-2 bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5">
                <Users class="w-4 h-4 text-gray-500" />
                <select
                  v-model="selectedTeamId"
                  :disabled="isLoadingTeams"
                  class="bg-transparent text-sm font-medium text-gray-800 focus:outline-none cursor-pointer pr-2"
                >
                  <option v-for="team in teams" :key="team.teamId" :value="team.teamId">
                    {{ team.teamName || team.name }}
                  </option>
                </select>
                <span
                  v-if="currentTeam"
                  :class="[
                    'text-xs font-semibold px-2 py-0.5 rounded-full border',
                    getRoleBadge(currentTeam.role).class
                  ]"
                >
                  {{ getRoleBadge(currentTeam.role).text }}
                </span>
              </div>

              <!-- Botão Atualizar -->
              <button
                @click="handleRefresh"
                :disabled="isRefreshing"
                class="flex items-center space-x-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                title="Recarregar dados"
              >
                <RefreshCw :class="['w-4 h-4', { 'animate-spin': isRefreshing }]" />
                <span class="hidden sm:inline">Atualizar</span>
              </button>
            </div>
          </div>

          <!-- Status Instagram da Equipe -->
          <div class="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div v-if="isInstagramConnected && instagramConnection?.account" class="flex items-center space-x-2 text-gray-700">
              <Instagram class="w-4 h-4 text-pink-600" />
              <span>Instagram vinculado:</span>
              <a
                :href="`https://instagram.com/${instagramConnection.account.username}`"
                target="_blank"
                rel="noopener noreferrer"
                class="font-semibold text-gray-900 hover:text-vibrant-green underline inline-flex items-center space-x-1"
              >
                <span>@{{ instagramConnection.account.username }}</span>
                <ExternalLink class="w-3 h-3 text-gray-400" />
              </a>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Conectado
              </span>
            </div>

            <div v-else class="flex items-center space-x-2 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
              <AlertTriangle class="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Instagram não conectado nesta equipe.</span>
              <button
                @click="router.push('/settings')"
                class="font-semibold underline hover:text-amber-900 ml-1"
              >
                Conectar Conta
              </button>
            </div>

            <div class="text-xs text-gray-400">
              Dados sincronizados em tempo real com os serviços do QuaviMkt
            </div>
          </div>
        </div>

        <!-- ========================================== -->
        <!-- BANNER DE CONVITES PENDENTES (SE HOUVER) -->
        <!-- ========================================== -->
        <div
          v-if="pendingInvitations.length > 0"
          class="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm"
        >
          <div class="flex items-start space-x-3">
            <div class="p-2 bg-blue-100 text-blue-700 rounded-lg flex-shrink-0 mt-0.5">
              <Mail class="w-5 h-5" />
            </div>
            <div class="flex-1">
              <h3 class="text-sm font-bold text-blue-900">
                Você recebeu {{ pendingInvitations.length === 1 ? 'um convite de equipe' : `${pendingInvitations.length} convites de equipe` }}!
              </h3>
              <p class="text-xs text-blue-700 mt-0.5">
                Outros gestores convidaram você para colaborar em seus times.
              </p>

              <div class="mt-3 space-y-2">
                <div
                  v-for="invite in pendingInvitations"
                  :key="invite.id"
                  class="bg-white p-3 rounded-lg border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div class="text-sm">
                    <span class="font-bold text-gray-900">{{ invite.teamName }}</span>
                    <span class="text-xs text-gray-500 ml-2">Convidado por {{ invite.invitedByName }}</span>
                    <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      Papel: {{ invite.role }}
                    </span>
                  </div>

                  <div class="flex items-center space-x-2">
                    <button
                      @click="handleAcceptInvitation(invite.id)"
                      :disabled="isProcessingInvitation === invite.id"
                      class="inline-flex items-center space-x-1 px-3 py-1 bg-vibrant-green text-white text-xs font-semibold rounded-md hover:bg-opacity-90 transition-colors disabled:opacity-50"
                    >
                      <Check class="w-3.5 h-3.5" />
                      <span>Aceitar</span>
                    </button>
                    <button
                      @click="handleDeclineInvitation(invite.id)"
                      :disabled="isProcessingInvitation === invite.id"
                      class="inline-flex items-center space-x-1 px-3 py-1 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <X class="w-3.5 h-3.5" />
                      <span>Recusar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Banner de Erro Global -->
        <div
          v-if="errorMessage"
          class="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between"
        >
          <div class="flex items-center space-x-2">
            <AlertTriangle class="w-5 h-5 text-red-500 flex-shrink-0" />
            <span>{{ errorMessage }}</span>
          </div>
          <button @click="errorMessage = ''" class="text-red-500 hover:text-red-700 text-sm font-semibold">
            Fechar
          </button>
        </div>

        <!-- ========================================== -->
        <!-- 4 CARDS DE KPIS REAIS -->
        <!-- ========================================== -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <!-- Card 1: Acervo de Postagens -->
          <div
            @click="router.push('/posts')"
            class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
          >
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Acervo de Posts</span>
              <div class="p-2.5 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                <FileText class="w-5 h-5" />
              </div>
            </div>
            <div class="text-3xl font-extrabold text-gray-900 mb-1">
              {{ postsCount }}
            </div>
            <p class="text-xs text-gray-500 flex items-center justify-between">
              <span>Posts salvos no seu acervo</span>
              <ArrowRight class="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </div>

          <!-- Card 2: Publicações Ativas / Agendadas -->
          <div
            @click="router.push('/publications')"
            class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-green-300 transition-all group"
          >
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Publicações Ativas</span>
              <div class="p-2.5 bg-green-50 text-vibrant-green rounded-lg group-hover:scale-110 transition-transform">
                <Share2 class="w-5 h-5" />
              </div>
            </div>
            <div class="text-3xl font-extrabold text-gray-900 mb-1">
              {{ scheduledPublicationsCount }}
            </div>
            <p class="text-xs text-gray-500 flex items-center justify-between">
              <span>Em fluxo para o Instagram</span>
              <ArrowRight class="w-3.5 h-3.5 text-vibrant-green opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </div>

          <!-- Card 3: Aprovações Pendentes -->
          <div
            @click="router.push('/publications')"
            class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-amber-300 transition-all group"
          >
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Aprovações</span>
              <div class="p-2.5 bg-amber-50 text-amber-600 rounded-lg group-hover:scale-110 transition-transform">
                <Clock class="w-5 h-5" />
              </div>
            </div>
            <div class="text-3xl font-extrabold text-gray-900 mb-1 flex items-baseline space-x-2">
              <span>{{ pendingApprovalsCount }}</span>
              <span v-if="pendingApprovalsCount > 0" class="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                Requer ação
              </span>
            </div>
            <p class="text-xs text-gray-500 flex items-center justify-between">
              <span>Aguardando moderação</span>
              <ArrowRight class="w-3.5 h-3.5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </div>

          <!-- Card 4: Campanhas Ativas -->
          <div
            @click="router.push('/campaigns')"
            class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-purple-300 transition-all group"
          >
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Campanhas</span>
              <div class="p-2.5 bg-purple-50 text-purple-600 rounded-lg group-hover:scale-110 transition-transform">
                <Building2 class="w-5 h-5" />
              </div>
            </div>
            <div class="text-3xl font-extrabold text-gray-900 mb-1">
              {{ campaigns.length }}
            </div>
            <p class="text-xs text-gray-500 flex items-center justify-between">
              <span>Campanhas cadastradas no time</span>
              <ArrowRight class="w-3.5 h-3.5 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </div>
        </div>

        <!-- ========================================== -->
        <!-- GRID PRINCIPAL: ÚLTIMAS PUBLICAÇÕES + CAMPANHAS -->
        <!-- ========================================== -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <!-- COLUNA ESQUERDA (2/3): ÚLTIMAS PUBLICAÇÕES -->
          <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <div class="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 class="text-base font-bold text-gray-900">Últimas Publicações do Time</h2>
                <p class="text-xs text-gray-500 mt-0.5">Postagens em fluxo operacional ou veiculadas no Instagram</p>
              </div>
              <button
                @click="router.push('/publications')"
                class="text-xs font-semibold text-vibrant-green hover:underline inline-flex items-center space-x-1"
              >
                <span>Ver todas</span>
                <ArrowRight class="w-3.5 h-3.5" />
              </button>
            </div>

            <div class="p-5 flex-1">
              <!-- Loading State -->
              <div v-if="isLoadingData" class="space-y-3 animate-pulse">
                <div v-for="i in 3" :key="i" class="h-16 bg-gray-100 rounded-lg"></div>
              </div>

              <!-- Empty State -->
              <div
                v-else-if="recentPublications.length === 0"
                class="py-12 text-center"
              >
                <div class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                  <Share2 class="w-6 h-6" />
                </div>
                <h4 class="text-sm font-semibold text-gray-800">Nenhuma publicação registrada</h4>
                <p class="text-xs text-gray-500 mt-1 max-w-sm mx-auto mb-4">
                  Crie uma postagem a partir do acervo e solicite o agendamento para o Instagram da sua equipe.
                </p>
                <button
                  @click="router.push('/publications')"
                  class="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-vibrant-green text-white text-xs font-semibold rounded-lg hover:bg-opacity-90 transition-colors shadow-sm"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>Criar Publicação</span>
                </button>
              </div>

              <!-- Lista de Publicações Recentes -->
              <div v-else class="space-y-3">
                <div
                  v-for="pub in recentPublications"
                  :key="pub.id"
                  @click="router.push('/publications')"
                  class="p-3.5 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50/60 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div class="flex items-start space-x-3 min-w-0">
                    <div
                      :class="[
                        'p-2 rounded-lg flex-shrink-0 text-xs font-bold uppercase',
                        pub.format === 'story' || pub.format === 2
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      ]"
                    >
                      {{ formatFormatLabel(pub.format) }}
                    </div>

                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-gray-900 truncate" :title="pub.caption">
                        {{ pub.caption || 'Sem legenda informada' }}
                      </p>
                      <div class="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                        <span>Por {{ pub.requestedByName || 'Usuário' }}</span>
                        <span>•</span>
                        <span>{{ formatDate(pub.publishedAt || pub.scheduledFor || pub.requestedAt) }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center space-x-2 flex-shrink-0 self-start sm:self-center">
                    <span
                      :class="[
                        'text-xs font-semibold px-2.5 py-1 rounded-full border',
                        getPublicationStatusBadge(pub.status).class
                      ]"
                    >
                      {{ getPublicationStatusBadge(pub.status).text }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- COLUNA DIREITA (1/3): CAMPANHAS DO TIME -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <div class="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 class="text-base font-bold text-gray-900">Campanhas Ativas</h2>
                <p class="text-xs text-gray-500 mt-0.5">{{ campaigns.length }} {{ campaigns.length === 1 ? 'campanha' : 'campanhas' }} no time</p>
              </div>
              <button
                @click="router.push('/campaigns')"
                class="text-xs font-semibold text-vibrant-green hover:underline inline-flex items-center space-x-1"
              >
                <span>Gerenciar</span>
                <ArrowRight class="w-3.5 h-3.5" />
              </button>
            </div>

            <div class="p-5 flex-1">
              <!-- Loading State -->
              <div v-if="isLoadingData" class="space-y-3 animate-pulse">
                <div v-for="i in 3" :key="i" class="h-14 bg-gray-100 rounded-lg"></div>
              </div>

              <!-- Empty State -->
              <div
                v-else-if="campaigns.length === 0"
                class="py-12 text-center"
              >
                <div class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                  <Building2 class="w-6 h-6" />
                </div>
                <h4 class="text-sm font-semibold text-gray-800">Nenhuma campanha criada</h4>
                <p class="text-xs text-gray-500 mt-1 max-w-xs mx-auto mb-4">
                  Crie campanhas estratégicas para organizar o lançamento de produtos e serviços.
                </p>
                <button
                  @click="router.push('/campaigns')"
                  class="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-vibrant-green text-white text-xs font-semibold rounded-lg hover:bg-opacity-90 transition-colors shadow-sm"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>Nova Campanha</span>
                </button>
              </div>

              <!-- Lista de Campanhas -->
              <div v-else class="space-y-3">
                <div
                  v-for="camp in campaigns.slice(0, 5)"
                  :key="camp.campaignId"
                  @click="router.push('/analytics')"
                  class="p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50/60 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div class="min-w-0 flex-1 pr-2">
                    <h4 class="text-sm font-semibold text-gray-900 truncate" :title="camp.name">
                      {{ camp.name }}
                    </h4>
                    <span class="text-xs text-gray-500">Clique para ver métricas</span>
                  </div>
                  <div class="p-1.5 rounded-lg bg-gray-100 text-gray-400 group-hover:text-vibrant-green group-hover:bg-soft-green/30 transition-colors">
                    <BarChart3 class="w-4 h-4" />
                  </div>
                </div>

                <div v-if="campaigns.length > 5" class="pt-2 text-center">
                  <button
                    @click="router.push('/campaigns')"
                    class="text-xs text-gray-500 hover:text-gray-900 font-medium"
                  >
                    +{{ campaigns.length - 5 }} outras campanhas no time
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  </div>
</template>
