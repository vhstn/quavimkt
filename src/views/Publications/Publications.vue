<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import {
  Share2,
  Instagram,
  Plus,
  Loader2,
  Check,
  X,
  Clock,
  Calendar,
  CalendarClock,
  Filter,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle2,
  Building2,
  Crown,
  Shield,
  User,
  Image as ImageIcon,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Send,
  MessageSquare,
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

interface PublicationSummary {
  id: string;
  postId: string;
  caption: string;
  thumbnailMediaId?: string;
  mediaCount: number;
  format: "feed" | "story" | string;
  status:
    | "pendingApproval"
    | "approved"
    | "rejected"
    | "canceled"
    | "publishing"
    | "published"
    | "failed"
    | string;
  scheduledFor: string;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  publishedAt?: string;
}

interface AssetInfo {
  media: {
    id: string;
    fileName: string;
  };
  sequenceOrder: number;
}

interface PublicationDetails {
  id: string;
  postId: string;
  caption: string;
  assets: AssetInfo[];
  format: string;
  status: string;
  scheduledFor: string;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  publishedAt?: string;
  externalIds: string[];
  failureReason?: string;
}

interface TeamCampaign {
  campaignId: string;
  name: string;
  status: string;
}

interface CampaignPostItem {
  postId: string;
  caption?: string;
  status?: string;
}

// ==========================================
// ESTADO: Times e Seleção
// ==========================================
const teams = ref<UserTeam[]>([]);
const selectedTeamId = ref("");
const isFetchingTeams = ref(true);

// ==========================================
// ESTADO: Conexão do Instagram
// ==========================================
const instagramConnection = ref<InstagramConnection | null>(null);
const isFetchingInstagram = ref(false);

// ==========================================
// ESTADO: Publicações e Filtros
// ==========================================
const publications = ref<PublicationSummary[]>([]);
const totalCount = ref(0);
const isFetchingPublications = ref(false);
const activeTab = ref<"all" | "pending">("all");
const statusFilter = ref<string>("all");
const formatFilter = ref<string>("all");

// ==========================================
// ESTADO: Modal Nova Publicação
// ==========================================
const isRequestDialogOpen = ref(false);
const availableCampaigns = ref<TeamCampaign[]>([]);
const isFetchingCampaigns = ref(false);
const selectedCampaignId = ref("");
const campaignPosts = ref<CampaignPostItem[]>([]);
const isFetchingCampaignPosts = ref(false);
const selectedPostId = ref("");
const publicationFormat = ref<"feed" | "story">("feed");
const scheduleType = ref<"immediate" | "scheduled">("immediate");
const scheduledDate = ref("");
const isSubmittingPublication = ref(false);

// ==========================================
// ESTADO: Ações de Moderação
// ==========================================
const isApproving = ref<Record<string, boolean>>({});

const isRejectDialogOpen = ref(false);
const publicationToReject = ref<PublicationSummary | null>(null);
const rejectionReason = ref("");
const isRejecting = ref(false);

const isRescheduleDialogOpen = ref(false);
const publicationToReschedule = ref<PublicationSummary | null>(null);
const newScheduleDate = ref("");
const isRescheduling = ref(false);

const isCancelDialogOpen = ref(false);
const publicationToCancel = ref<PublicationSummary | null>(null);
const isCanceling = ref(false);

const isDetailsDialogOpen = ref(false);
const publicationDetails = ref<PublicationDetails | null>(null);
const isFetchingDetails = ref(false);

// ==========================================
// ESTADO: Feedback
// ==========================================
const isSuccessDialogOpen = ref(false);
const successTitle = ref("Sucesso!");
const successMessage = ref("");

const isErrorDialogOpen = ref(false);
const errorMessage = ref("");

// ==========================================
// COMPUTED & HELPERS
// ==========================================
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

const pendingPublicationsCount = computed(() => {
  return publications.value.filter(
    (p) => p.status.toLowerCase() === "pendingapproval"
  ).length;
});

const filteredPublications = computed(() => {
  let list = publications.value;

  if (activeTab.value === "pending") {
    return list.filter((p) => p.status.toLowerCase() === "pendingapproval");
  }

  if (statusFilter.value !== "all") {
    list = list.filter((p) => p.status.toLowerCase() === statusFilter.value.toLowerCase());
  }

  if (formatFilter.value !== "all") {
    list = list.filter((p) => p.format.toLowerCase() === formatFilter.value.toLowerCase());
  }

  return list;
});

const minScheduleDateTime = computed(() => {
  const now = new Date(Date.now() + 5 * 60 * 1000);
  return now.toISOString().slice(0, 16);
});

const maxScheduleDateTime = computed(() => {
  const max = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return max.toISOString().slice(0, 16);
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

const formatStatus = (status?: string) => {
  if (!status) return "Pendente";
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "pendingapproval":
      return "Aguardando Aprovação";
    case "approved":
      return "Aprovado / Agendado";
    case "publishing":
      return "Em Envio...";
    case "published":
      return "Publicado";
    case "rejected":
      return "Reprovado";
    case "canceled":
      return "Cancelado";
    case "failed":
      return "Falhou";
    default:
      return status;
  }
};

const getStatusBadgeClasses = (status?: string) => {
  if (!status) return "bg-gray-100 text-gray-700 border-gray-200";
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "pendingapproval":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "approved":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "publishing":
      return "bg-purple-100 text-purple-800 border-purple-200 animate-pulse";
    case "published":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200";
    case "canceled":
      return "bg-gray-100 text-gray-600 border-gray-200";
    case "failed":
      return "bg-rose-100 text-rose-900 border-rose-300 font-semibold";
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

// ==========================================
// MÉTODOS: Carregamento
// ==========================================
const fetchTeams = async () => {
  isFetchingTeams.value = true;
  try {
    const response = await apiFetch("/identity/users/me/teams");
    if (!response.ok) throw new Error(await parseErrorMessage(response, "Erro ao carregar times."));
    const data = await response.json();
    teams.value = data.teams || [];

    if (teams.value.length > 0) {
      const firstTeam = teams.value[0];
      const initialId = firstTeam.teamId || firstTeam.id || "";
      selectedTeamId.value = initialId;
      await Promise.all([
        fetchInstagramStatus(initialId),
        fetchPublications(initialId),
      ]);
    }
  } catch (error: any) {
    showError(error.message || "Falha na comunicação com o servidor.");
  } finally {
    isFetchingTeams.value = false;
  }
};

const fetchInstagramStatus = async (teamId: string) => {
  if (!teamId) return;
  isFetchingInstagram.value = true;
  try {
    const response = await apiFetch(`/teams/${teamId}/social/instagram`);
    if (response.ok) {
      const data: InstagramConnection = await response.json();
      instagramConnection.value = data;
    } else {
      instagramConnection.value = { isConfigured: false, account: null };
    }
  } catch (error) {
    console.error("Erro ao carregar status do Instagram:", error);
    instagramConnection.value = { isConfigured: false, account: null };
  } finally {
    isFetchingInstagram.value = false;
  }
};

const fetchPublications = async (teamId: string) => {
  if (!teamId) return;
  isFetchingPublications.value = true;
  try {
    const response = await apiFetch(`/teams/${teamId}/social/instagram/publications`);
    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao carregar publicações."));
    }
    const data = await response.json();
    publications.value = data.items || data.publications || (Array.isArray(data) ? data : []);
    totalCount.value = typeof data.totalCount === "number" ? data.totalCount : publications.value.length;
  } catch (error: any) {
    showError(error.message || "Erro ao consultar publicações.");
  } finally {
    isFetchingPublications.value = false;
  }
};

const handleTeamChange = async () => {
  if (selectedTeamId.value) {
    await Promise.all([
      fetchInstagramStatus(selectedTeamId.value),
      fetchPublications(selectedTeamId.value),
    ]);
  }
};

// ==========================================
// MÉTODOS: Solicitação de Publicação
// ==========================================
const openRequestModal = async () => {
  if (!instagramConnection.value?.isConfigured) {
    showError("A equipe precisa ter uma conta do Instagram conectada para publicar.");
    return;
  }

  selectedCampaignId.value = "";
  selectedPostId.value = "";
  publicationFormat.value = "feed";
  scheduleType.value = "immediate";
  scheduledDate.value = minScheduleDateTime.value;
  campaignPosts.value = [];

  isRequestDialogOpen.value = true;
  await fetchTeamCampaigns(selectedTeamId.value);
};

const fetchTeamCampaigns = async (teamId: string) => {
  if (!teamId) return;
  isFetchingCampaigns.value = true;
  try {
    const response = await apiFetch(`/workflow/teams/${teamId}/campaigns`);
    if (!response.ok) throw new Error("Erro ao buscar campanhas.");
    const data = await response.json();
    availableCampaigns.value = data.campaigns || [];
  } catch (error: any) {
    showError(error.message || "Erro ao carregar campanhas.");
  } finally {
    isFetchingCampaigns.value = false;
  }
};

const handleCampaignSelect = async () => {
  selectedPostId.value = "";
  if (!selectedCampaignId.value || !selectedTeamId.value) {
    campaignPosts.value = [];
    return;
  }

  isFetchingCampaignPosts.value = true;
  try {
    const response = await apiFetch(
      `/workflow/teams/${selectedTeamId.value}/campaigns/${selectedCampaignId.value}/posts`
    );
    if (!response.ok) throw new Error("Erro ao buscar postagens da campanha.");
    const data = await response.json();
    campaignPosts.value = data.posts || [];
  } catch (error: any) {
    showError(error.message || "Erro ao carregar postagens da campanha.");
  } finally {
    isFetchingCampaignPosts.value = false;
  }
};

const handleCreatePublication = async () => {
  if (!selectedTeamId.value || !selectedPostId.value) {
    showError("Por favor, selecione uma postagem para publicar.");
    return;
  }

  let scheduledForIso: string | null = null;
  if (scheduleType.value === "scheduled") {
    if (!scheduledDate.value) {
      showError("Informe uma data e hora válida para o agendamento.");
      return;
    }
    const scheduledMoment = new Date(scheduledDate.value);
    if (isNaN(scheduledMoment.getTime())) {
      showError("Data de agendamento inválida.");
      return;
    }
    scheduledForIso = scheduledMoment.toISOString();
  }

  isSubmittingPublication.value = true;
  try {
    const response = await apiFetch(
      `/teams/${selectedTeamId.value}/social/instagram/publications`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: selectedPostId.value,
          format: publicationFormat.value,
          scheduledFor: scheduledForIso,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao solicitar publicação."));
    }

    isRequestDialogOpen.value = false;
    showSuccess(
      isManagerOfSelectedTeam.value
        ? "Publicação aprovada e registrada na fila com sucesso!"
        : "Publicação solicitada com sucesso! Ela aguarda aprovação de um gestor.",
      "Publicação Registrada"
    );
    await fetchPublications(selectedTeamId.value);
  } catch (error: any) {
    showError(error.message || "Erro ao registrar publicação.");
  } finally {
    isSubmittingPublication.value = false;
  }
};

// ==========================================
// MÉTODOS: Aprovar Publicação
// ==========================================
const handleApprove = async (pub: PublicationSummary) => {
  if (!selectedTeamId.value) return;
  isApproving.value[pub.id] = true;
  try {
    const response = await apiFetch(
      `/teams/${selectedTeamId.value}/social/instagram/publications/${pub.id}/approve`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao aprovar publicação."));
    }

    showSuccess("A publicação foi aprovada e sairá no horário programado!", "Publicação Aprovada");
    await fetchPublications(selectedTeamId.value);
  } catch (error: any) {
    showError(error.message || "Erro na aprovação.");
  } finally {
    isApproving.value[pub.id] = false;
  }
};

// ==========================================
// MÉTODOS: Recusar Publicação
// ==========================================
const openRejectModal = (pub: PublicationSummary) => {
  publicationToReject.value = pub;
  rejectionReason.value = "";
  isRejectDialogOpen.value = true;
};

const handleConfirmReject = async () => {
  if (!selectedTeamId.value || !publicationToReject.value) return;
  if (!rejectionReason.value.trim()) {
    showError("Por favor, informe a justificativa da recusa.");
    return;
  }

  isRejecting.value = true;
  try {
    const response = await apiFetch(
      `/teams/${selectedTeamId.value}/social/instagram/publications/${publicationToReject.value.id}/reject`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: rejectionReason.value.trim(),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao recusar publicação."));
    }

    isRejectDialogOpen.value = false;
    showSuccess("A publicação foi reprovada e o autor foi notificado com o motivo.", "Publicação Reprovada");
    await fetchPublications(selectedTeamId.value);
  } catch (error: any) {
    showError(error.message || "Erro ao reprovar.");
  } finally {
    isRejecting.value = false;
  }
};

// ==========================================
// MÉTODOS: Reagendar Publicação
// ==========================================
const openRescheduleModal = (pub: PublicationSummary) => {
  publicationToReschedule.value = pub;
  try {
    const current = new Date(pub.scheduledFor);
    newScheduleDate.value = !isNaN(current.getTime())
      ? current.toISOString().slice(0, 16)
      : minScheduleDateTime.value;
  } catch {
    newScheduleDate.value = minScheduleDateTime.value;
  }
  isRescheduleDialogOpen.value = true;
};

const handleConfirmReschedule = async () => {
  if (!selectedTeamId.value || !publicationToReschedule.value) return;
  if (!newScheduleDate.value) {
    showError("Selecione um novo horário para a publicação.");
    return;
  }

  const newMoment = new Date(newScheduleDate.value);
  if (isNaN(newMoment.getTime())) {
    showError("Horário inválido.");
    return;
  }

  isRescheduling.value = true;
  try {
    const response = await apiFetch(
      `/teams/${selectedTeamId.value}/social/instagram/publications/${publicationToReschedule.value.id}/reschedule`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scheduledFor: newMoment.toISOString(),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao reagendar publicação."));
    }

    isRescheduleDialogOpen.value = false;
    showSuccess("O horário da publicação foi alterado com sucesso!", "Horário Atualizado");
    await fetchPublications(selectedTeamId.value);
  } catch (error: any) {
    showError(error.message || "Erro ao reagendar.");
  } finally {
    isRescheduling.value = false;
  }
};

// ==========================================
// MÉTODOS: Cancelar Publicação
// ==========================================
const openCancelModal = (pub: PublicationSummary) => {
  publicationToCancel.value = pub;
  isCancelDialogOpen.value = true;
};

const handleConfirmCancel = async () => {
  if (!selectedTeamId.value || !publicationToCancel.value) return;

  isCanceling.value = true;
  try {
    const response = await apiFetch(
      `/teams/${selectedTeamId.value}/social/instagram/publications/${publicationToCancel.value.id}/cancel`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao cancelar publicação."));
    }

    isCancelDialogOpen.value = false;
    showSuccess("A publicação foi cancelada e não será enviada ao Instagram.", "Publicação Cancelada");
    await fetchPublications(selectedTeamId.value);
  } catch (error: any) {
    showError(error.message || "Erro ao cancelar.");
  } finally {
    isCanceling.value = false;
  }
};

// ==========================================
// MÉTODOS: Detalhes da Publicação
// ==========================================
const openDetailsModal = async (pub: PublicationSummary) => {
  if (!selectedTeamId.value) return;
  publicationDetails.value = null;
  isDetailsDialogOpen.value = true;
  isFetchingDetails.value = true;

  try {
    const response = await apiFetch(
      `/teams/${selectedTeamId.value}/social/instagram/publications/${pub.id}`
    );
    if (!response.ok) throw new Error(await parseErrorMessage(response, "Erro ao carregar detalhes."));
    const data: PublicationDetails = await response.json();
    publicationDetails.value = data;
  } catch (error: any) {
    showError(error.message || "Erro ao buscar detalhes da publicação.");
  } finally {
    isFetchingDetails.value = false;
  }
};

const canModerate = (pub: PublicationSummary) => {
  return isManagerOfSelectedTeam.value && pub.status.toLowerCase() === "pendingapproval";
};

const canCancelOrReschedule = (pub: PublicationSummary) => {
  const status = pub.status.toLowerCase();
  return status === "pendingapproval" || status === "approved";
};

onMounted(() => {
  fetchTeams();
});
</script>

<template>
  <div class="flex min-h-screen bg-gray-50">
    <AppSidebar />

    <main class="flex-1 overflow-auto">
      <div class="p-8 max-w-6xl">
        <!-- Cabeçalho Principal -->
        <div class="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center space-x-2 text-vibrant-green mb-1 font-semibold text-xs tracking-wider uppercase">
              <Share2 class="w-4 h-4" />
              <span>Redes Sociais</span>
            </div>
            <h1 class="text-2xl font-semibold text-gray-900">
              Publicações no Instagram
            </h1>
            <p class="text-gray-600 text-sm">
              Gerencie a fila de agendamentos, caixa de aprovações e o histórico social do time.
            </p>
          </div>

          <div class="flex items-center space-x-3">
            <button
              type="button"
              @click="openRequestModal"
              :disabled="!instagramConnection?.isConfigured"
              class="flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2.5 px-4 rounded-lg transition-all shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus class="w-4 h-4 mr-2" />
              Nova Publicação
            </button>
          </div>
        </div>

        <!-- Barra Superior: Seletor de Time e Status do Instagram -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <!-- Seletor de Time -->
          <div class="flex items-center space-x-3">
            <Building2 class="w-5 h-5 text-gray-400" />
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase">
                Equipe Ativa
              </label>
              <div v-if="isFetchingTeams" class="text-xs text-gray-400">
                Carregando...
              </div>
              <select
                v-else-if="teams.length > 0"
                v-model="selectedTeamId"
                @change="handleTeamChange"
                class="bg-transparent font-semibold text-gray-900 text-sm outline-none cursor-pointer hover:text-vibrant-green transition-colors"
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
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ml-2',
                getRoleBadgeClasses(selectedTeam.role),
              ]"
            >
              <Crown v-if="selectedTeam.role === 'owner'" class="w-3 h-3 mr-1" />
              <Shield v-else-if="selectedTeam.role === 'administrator'" class="w-3 h-3 mr-1" />
              <User v-else class="w-3 h-3 mr-1" />
              {{ formatRole(selectedTeam.role) }}
            </span>
          </div>

          <!-- Status da Conexão do Instagram -->
          <div class="flex items-center space-x-3">
            <div
              v-if="instagramConnection?.isConfigured"
              class="flex items-center space-x-2 text-xs text-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 px-3 py-1.5 rounded-lg border border-pink-200"
            >
              <Instagram class="w-4 h-4 text-rose-500" />
              <span>Conectado como <strong>@{{ instagramConnection.account?.username }}</strong></span>
            </div>
            <div
              v-else
              class="flex items-center space-x-2 text-xs text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200"
            >
              <AlertCircle class="w-4 h-4 text-amber-600" />
              <span>Instagram não conectado.</span>
              <router-link
                to="/settings"
                class="text-vibrant-green font-semibold hover:underline ml-1"
              >
                Configurar
              </router-link>
            </div>
          </div>
        </div>

        <!-- Abas de Navegação -->
        <div class="flex items-center justify-between border-b border-gray-200 mb-6">
          <div class="flex space-x-6">
            <button
              type="button"
              @click="activeTab = 'all'"
              :class="[
                'pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                activeTab === 'all'
                  ? 'border-vibrant-green text-vibrant-green'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ]"
            >
              <CalendarClock class="w-4 h-4" />
              Todas as Publicações ({{ publications.length }})
            </button>

            <button
              type="button"
              @click="activeTab = 'pending'"
              :class="[
                'pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                activeTab === 'pending'
                  ? 'border-vibrant-green text-vibrant-green'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ]"
            >
              <Clock class="w-4 h-4" />
              Caixa de Aprovações
              <span
                v-if="pendingPublicationsCount > 0"
                class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-bold"
              >
                {{ pendingPublicationsCount }}
              </span>
            </button>
          </div>

          <!-- Filtros rápidos para aba 'all' -->
          <div v-if="activeTab === 'all'" class="flex items-center space-x-3 pb-3">
            <select
              v-model="statusFilter"
              class="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-vibrant-green"
            >
              <option value="all">Todos os Status</option>
              <option value="pendingApproval">Aguardando Aprovação</option>
              <option value="approved">Aprovados / Agendados</option>
              <option value="published">Publicados</option>
              <option value="rejected">Reprovados</option>
              <option value="canceled">Cancelados</option>
              <option value="failed">Falhas</option>
            </select>

            <select
              v-model="formatFilter"
              class="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-vibrant-green"
            >
              <option value="all">Todos os Formatos</option>
              <option value="feed">Feed / Carrossel</option>
              <option value="story">Stories</option>
            </select>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="isFetchingPublications" class="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex justify-center">
          <Loader2 class="w-8 h-8 text-vibrant-green animate-spin" />
        </div>

        <!-- Empty State -->
        <div
          v-else-if="filteredPublications.length === 0"
          class="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center"
        >
          <CalendarClock class="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 class="text-base font-semibold text-gray-900 mb-1">
            {{ activeTab === 'pending' ? 'Nenhuma publicação aguardando aprovação' : 'Nenhuma publicação encontrada' }}
          </h2>
          <p class="text-xs text-gray-500 max-w-sm mx-auto mb-6">
            {{ activeTab === 'pending'
                ? 'Todas as solicitações de membros já foram avaliadas por um gestor da equipe.'
                : 'Crie e solicite a publicação de postagens vinculadas a campanhas para o Instagram.' }}
          </p>
          <button
            v-if="instagramConnection?.isConfigured && activeTab === 'all'"
            type="button"
            @click="openRequestModal"
            class="inline-flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2 px-4 rounded-lg text-xs transition-all shadow-sm"
          >
            <Plus class="w-4 h-4 mr-1.5" />
            Nova Publicação
          </button>
        </div>

        <!-- Tabela / Lista de Publicações -->
        <div v-else class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Publicação</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Horário Programado</TableHead>
                <TableHead>Solicitado por</TableHead>
                <TableHead class="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="pub in filteredPublications" :key="pub.id" class="hover:bg-gray-50/70 transition-colors">
                <!-- Coluna: Legenda e Mídias -->
                <TableCell class="font-medium text-gray-900">
                  <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 flex-shrink-0">
                      <ImageIcon class="w-5 h-5 text-gray-400" />
                    </div>
                    <div class="max-w-xs">
                      <p class="text-sm text-gray-900 truncate font-medium">
                        {{ pub.caption || "Sem legenda" }}
                      </p>
                      <span class="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Layers class="w-3 h-3" />
                        {{ pub.mediaCount }} {{ pub.mediaCount === 1 ? 'mídia' : 'mídias' }}
                      </span>
                    </div>
                  </div>
                </TableCell>

                <!-- Coluna: Formato -->
                <TableCell>
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-100">
                    {{ pub.format === 'feed' ? 'Feed' : 'Story' }}
                  </span>
                </TableCell>

                <!-- Coluna: Status -->
                <TableCell>
                  <span
                    :class="[
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                      getStatusBadgeClasses(pub.status),
                    ]"
                  >
                    {{ formatStatus(pub.status) }}
                  </span>
                </TableCell>

                <!-- Coluna: Horário -->
                <TableCell class="text-xs text-gray-600">
                  <div class="flex items-center gap-1.5">
                    <Clock class="w-3.5 h-3.5 text-gray-400" />
                    <span>{{ formatDate(pub.scheduledFor) }}</span>
                  </div>
                </TableCell>

                <!-- Coluna: Solicitante -->
                <TableCell class="text-xs text-gray-600">
                  {{ pub.requestedByName || "-" }}
                </TableCell>

                <!-- Coluna: Ações -->
                <TableCell class="text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <!-- Ações de Gestor na Caixa de Aprovação -->
                    <template v-if="canModerate(pub)">
                      <button
                        type="button"
                        @click="handleApprove(pub)"
                        :disabled="isApproving[pub.id]"
                        class="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                        title="Aprovar Publicação"
                      >
                        <Loader2 v-if="isApproving[pub.id]" class="w-4 h-4 animate-spin text-emerald-600" />
                        <Check v-else class="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        @click="openRejectModal(pub)"
                        class="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
                        title="Reprovar Publicação"
                      >
                        <X class="w-4 h-4" />
                      </button>
                    </template>

                    <!-- Ação: Reagendar -->
                    <button
                      v-if="canCancelOrReschedule(pub)"
                      type="button"
                      @click="openRescheduleModal(pub)"
                      class="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                      title="Reagendar horário"
                    >
                      <CalendarClock class="w-4 h-4" />
                    </button>

                    <!-- Ação: Cancelar -->
                    <button
                      v-if="canCancelOrReschedule(pub)"
                      type="button"
                      @click="openCancelModal(pub)"
                      class="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                      title="Cancelar publicação"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>

                    <!-- Ação: Ver Detalhes -->
                    <button
                      type="button"
                      @click="openDetailsModal(pub)"
                      class="p-1.5 text-gray-400 hover:text-gray-900 rounded transition-colors"
                      title="Ver detalhes"
                    >
                      <Eye class="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <!-- ========================================== -->
        <!-- MODAL: NOVA PUBLICAÇÃO                     -->
        <!-- ========================================== -->
        <Dialog v-model:open="isRequestDialogOpen">
          <DialogContent class="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle class="text-gray-900 flex items-center gap-2">
                <Instagram class="w-5 h-5 text-rose-500" />
                Nova Publicação no Instagram
              </DialogTitle>
              <DialogDescription>
                Selecione uma postagem do time para agendar ou publicar no Instagram da equipe.
              </DialogDescription>
            </DialogHeader>

            <form @submit.prevent="handleCreatePublication" class="space-y-4 mt-2">
              <!-- Passo 1: Campanha -->
              <div>
                <label class="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  1. Campanha do Time *
                </label>
                <div v-if="isFetchingCampaigns" class="text-xs text-gray-500 flex items-center gap-2">
                  <Loader2 class="w-3.5 h-3.5 animate-spin text-vibrant-green" />
                  Carregando campanhas...
                </div>
                <select
                  v-else
                  v-model="selectedCampaignId"
                  @change="handleCampaignSelect"
                  class="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-vibrant-green outline-none"
                  required
                >
                  <option value="" disabled>Selecione uma campanha...</option>
                  <option
                    v-for="camp in availableCampaigns"
                    :key="camp.campaignId"
                    :value="camp.campaignId"
                  >
                    {{ camp.name }}
                  </option>
                </select>
              </div>

              <!-- Passo 2: Postagem da Campanha -->
              <div v-if="selectedCampaignId">
                <label class="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  2. Postagem a Publicar *
                </label>
                <div v-if="isFetchingCampaignPosts" class="text-xs text-gray-500 flex items-center gap-2">
                  <Loader2 class="w-3.5 h-3.5 animate-spin text-vibrant-green" />
                  Carregando postagens da campanha...
                </div>
                <div v-else-if="campaignPosts.length === 0" class="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  Esta campanha não possui postagens associadas. Adicione uma postagem a ela na tela de Postagens primeiro.
                </div>
                <select
                  v-else
                  v-model="selectedPostId"
                  class="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-vibrant-green outline-none"
                  required
                >
                  <option value="" disabled>Selecione a postagem...</option>
                  <option
                    v-for="post in campaignPosts"
                    :key="post.postId"
                    :value="post.postId"
                  >
                    {{ post.caption || 'Sem legenda' }} (ID: {{ post.postId.slice(0, 8) }}...)
                  </option>
                </select>
              </div>

              <!-- Passo 3: Formato -->
              <div>
                <label class="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  3. Formato da Publicação *
                </label>
                <div class="grid grid-cols-2 gap-3">
                  <label
                    :class="[
                      'flex items-center p-3 border rounded-lg cursor-pointer transition-all',
                      publicationFormat === 'feed'
                        ? 'border-vibrant-green bg-soft-green/20 text-gray-900 font-medium'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700',
                    ]"
                  >
                    <input
                      type="radio"
                      v-model="publicationFormat"
                      value="feed"
                      class="hidden"
                    />
                    <ImageIcon class="w-4 h-4 mr-2 text-vibrant-green" />
                    <div>
                      <p class="text-sm">Feed / Carrossel</p>
                      <p class="text-xs text-gray-500">Post no feed principal</p>
                    </div>
                  </label>

                  <label
                    :class="[
                      'flex items-center p-3 border rounded-lg cursor-pointer transition-all',
                      publicationFormat === 'story'
                        ? 'border-vibrant-green bg-soft-green/20 text-gray-900 font-medium'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700',
                    ]"
                  >
                    <input
                      type="radio"
                      v-model="publicationFormat"
                      value="story"
                      class="hidden"
                    />
                    <Sparkles class="w-4 h-4 mr-2 text-purple-600" />
                    <div>
                      <p class="text-sm">Stories</p>
                      <p class="text-xs text-gray-500">1 story por imagem</p>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Passo 4: Agendamento -->
              <div>
                <label class="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  4. Momento da Publicação *
                </label>
                <div class="grid grid-cols-2 gap-3 mb-2">
                  <label
                    :class="[
                      'flex items-center p-2.5 border rounded-lg cursor-pointer transition-all text-xs',
                      scheduleType === 'immediate'
                        ? 'border-vibrant-green bg-soft-green/20 text-gray-900 font-medium'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700',
                    ]"
                  >
                    <input
                      type="radio"
                      v-model="scheduleType"
                      value="immediate"
                      class="hidden"
                    />
                    <Send class="w-3.5 h-3.5 mr-1.5 text-vibrant-green" />
                    Publicar Imediatamente
                  </label>

                  <label
                    :class="[
                      'flex items-center p-2.5 border rounded-lg cursor-pointer transition-all text-xs',
                      scheduleType === 'scheduled'
                        ? 'border-vibrant-green bg-soft-green/20 text-gray-900 font-medium'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700',
                    ]"
                  >
                    <input
                      type="radio"
                      v-model="scheduleType"
                      value="scheduled"
                      class="hidden"
                    />
                    <Clock class="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                    Agendar Horário
                  </label>
                </div>

                <div v-if="scheduleType === 'scheduled'" class="mt-2">
                  <input
                    type="datetime-local"
                    v-model="scheduledDate"
                    :min="minScheduleDateTime"
                    :max="maxScheduleDateTime"
                    class="w-full p-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-vibrant-green outline-none"
                    required
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    Permitido agendar com até 30 dias de antecedência.
                  </p>
                </div>
              </div>

              <!-- Aviso sobre aprovação -->
              <div
                v-if="!isManagerOfSelectedTeam"
                class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2"
              >
                <AlertCircle class="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  Como você é <strong>Membro</strong>, esta solicitação será encaminhada para a <strong>Caixa de Aprovação</strong> dos gestores antes do envio.
                </span>
              </div>

              <DialogFooter class="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  @click="isRequestDialogOpen = false"
                  :disabled="isSubmittingPublication"
                  class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="isSubmittingPublication || !selectedPostId"
                  class="flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2 px-6 rounded-lg transition-all disabled:opacity-50 text-sm shadow-sm"
                >
                  <Loader2 v-if="isSubmittingPublication" class="w-4 h-4 mr-2 animate-spin" />
                  <Instagram v-else class="w-4 h-4 mr-2" />
                  {{ isManagerOfSelectedTeam ? 'Confirmar Publicação' : 'Enviar Solicitação' }}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <!-- ========================================== -->
        <!-- MODAL: RECUSAR PUBLICAÇÃO                  -->
        <!-- ========================================== -->
        <Dialog v-model:open="isRejectDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle class="text-red-600 flex items-center gap-2">
                <X class="w-5 h-5" />
                Reprovar Publicação
              </DialogTitle>
              <DialogDescription>
                Informe o motivo da recusa. Essa justificativa será exibida para o autor da solicitação.
              </DialogDescription>
            </DialogHeader>

            <form @submit.prevent="handleConfirmReject" class="space-y-4 mt-2">
              <div>
                <label class="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Motivo da Reprovação *
                </label>
                <textarea
                  v-model="rejectionReason"
                  rows="3"
                  maxlength="500"
                  placeholder="Ex: A foto precisa de ajustes na legenda, ou a data sugerida coincide com outro anúncio..."
                  class="w-full p-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-red-500 outline-none resize-none"
                  required
                ></textarea>
                <div class="text-right text-xs text-gray-400 mt-1">
                  {{ rejectionReason.length }}/500 caracteres
                </div>
              </div>

              <DialogFooter class="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  @click="isRejectDialogOpen = false"
                  :disabled="isRejecting"
                  class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="isRejecting || !rejectionReason.trim()"
                  class="flex items-center bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-5 rounded-lg transition-all disabled:opacity-50 text-sm shadow-sm"
                >
                  <Loader2 v-if="isRejecting" class="w-4 h-4 mr-1.5 animate-spin" />
                  Reprovar
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <!-- ========================================== -->
        <!-- MODAL: REAGENDAR PUBLICAÇÃO                -->
        <!-- ========================================== -->
        <Dialog v-model:open="isRescheduleDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle class="text-gray-900 flex items-center gap-2">
                <CalendarClock class="w-5 h-5 text-blue-600" />
                Reagendar Publicação
              </DialogTitle>
              <DialogDescription>
                Escolha o novo horário para o envio ao Instagram.
              </DialogDescription>
            </DialogHeader>

            <form @submit.prevent="handleConfirmReschedule" class="space-y-4 mt-2">
              <div>
                <label class="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Novo Horário Programado *
                </label>
                <input
                  type="datetime-local"
                  v-model="newScheduleDate"
                  :min="minScheduleDateTime"
                  :max="maxScheduleDateTime"
                  class="w-full p-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-vibrant-green outline-none"
                  required
                />
                <p class="text-xs text-gray-500 mt-1">
                  Até 30 dias no futuro a partir de hoje.
                </p>
              </div>

              <div
                v-if="!isManagerOfSelectedTeam"
                class="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800"
              >
                Como membro, alterar o horário fará com que a publicação retorne para aprovação do gestor.
              </div>

              <DialogFooter class="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  @click="isRescheduleDialogOpen = false"
                  :disabled="isRescheduling"
                  class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="isRescheduling"
                  class="flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2 px-5 rounded-lg transition-all disabled:opacity-50 text-sm shadow-sm"
                >
                  <Loader2 v-if="isRescheduling" class="w-4 h-4 mr-1.5 animate-spin" />
                  Salvar Horário
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <!-- ========================================== -->
        <!-- MODAL: CANCELAR PUBLICAÇÃO                 -->
        <!-- ========================================== -->
        <Dialog v-model:open="isCancelDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle class="text-red-600 flex items-center gap-2">
                <Trash2 class="w-5 h-5" />
                Cancelar Publicação
              </DialogTitle>
              <DialogDescription class="leading-relaxed">
                Tem certeza de que deseja cancelar esta publicação agendada? Ela não será enviada ao Instagram.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter class="flex justify-end gap-3 pt-3">
              <button
                type="button"
                @click="isCancelDialogOpen = false"
                :disabled="isCanceling"
                class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg"
              >
                Voltar
              </button>
              <button
                type="button"
                @click="handleConfirmCancel"
                :disabled="isCanceling"
                class="flex items-center bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-5 rounded-lg transition-all disabled:opacity-50 text-sm shadow-sm"
              >
                <Loader2 v-if="isCanceling" class="w-4 h-4 mr-1.5 animate-spin" />
                Confirmar Cancelamento
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <!-- ========================================== -->
        <!-- MODAL: DETALHES DA PUBLICAÇÃO              -->
        <!-- ========================================== -->
        <Dialog v-model:open="isDetailsDialogOpen">
          <DialogContent class="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle class="text-gray-900 flex items-center justify-between">
                <span class="flex items-center gap-2">
                  <Instagram class="w-5 h-5 text-rose-500" />
                  Detalhes da Publicação
                </span>
                <span
                  v-if="publicationDetails"
                  :class="[
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border mr-6',
                    getStatusBadgeClasses(publicationDetails.status),
                  ]"
                >
                  {{ formatStatus(publicationDetails.status) }}
                </span>
              </DialogTitle>
              <DialogDescription>
                Informações completas do agendamento, mídias e moderação.
              </DialogDescription>
            </DialogHeader>

            <div v-if="isFetchingDetails" class="p-8 flex justify-center">
              <Loader2 class="w-6 h-6 text-vibrant-green animate-spin" />
            </div>

            <div v-else-if="publicationDetails" class="space-y-4 mt-2">
              <!-- Legenda -->
              <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Legenda
                </label>
                <p class="text-sm text-gray-800 whitespace-pre-line">
                  {{ publicationDetails.caption || 'Sem legenda cadastrada.' }}
                </p>
              </div>

              <!-- Galeria de Imagens -->
              <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-2">
                  Imagens Associadas ({{ publicationDetails.assets?.length || 0 }})
                </label>
                <div v-if="!publicationDetails.assets || publicationDetails.assets.length === 0" class="text-xs text-gray-400">
                  Nenhuma imagem vinculada.
                </div>
                <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  <div
                    v-for="asset in publicationDetails.assets"
                    :key="asset.media.id"
                    class="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-100 aspect-square flex items-center justify-center group"
                  >
                    <span class="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.2 rounded font-bold">
                      {{ asset.sequenceOrder }}º
                    </span>
                    <ImageIcon class="w-6 h-6 text-gray-400" />
                    <span class="absolute bottom-1 inset-x-1 text-[9px] text-gray-700 bg-white/90 px-1 truncate text-center rounded">
                      {{ asset.media.fileName }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Metadados em Grade -->
              <div class="grid grid-cols-2 gap-3 text-xs">
                <div class="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span class="text-gray-500 font-medium">Formato:</span>
                  <p class="font-semibold text-gray-800 uppercase mt-0.5">
                    {{ publicationDetails.format === 'feed' ? 'Feed / Carrossel' : 'Story' }}
                  </p>
                </div>

                <div class="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span class="text-gray-500 font-medium">Horário Programado:</span>
                  <p class="font-semibold text-gray-800 mt-0.5">
                    {{ formatDate(publicationDetails.scheduledFor) }}
                  </p>
                </div>

                <div class="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span class="text-gray-500 font-medium">Solicitado por:</span>
                  <p class="font-semibold text-gray-800 mt-0.5">
                    {{ publicationDetails.requestedByName }}
                  </p>
                  <span class="text-[10px] text-gray-400">
                    {{ formatDate(publicationDetails.requestedAt) }}
                  </span>
                </div>

                <div class="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span class="text-gray-500 font-medium">Revisado por:</span>
                  <p class="font-semibold text-gray-800 mt-0.5">
                    {{ publicationDetails.reviewedByName || 'Não aplicável' }}
                  </p>
                  <span v-if="publicationDetails.reviewedAt" class="text-[10px] text-gray-400">
                    {{ formatDate(publicationDetails.reviewedAt) }}
                  </span>
                </div>
              </div>

              <!-- Motivo de Recusa (se houver) -->
              <div
                v-if="publicationDetails.rejectionReason"
                class="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900"
              >
                <p class="font-bold mb-1 flex items-center gap-1.5 text-red-700">
                  <X class="w-4 h-4" />
                  Motivo da Reprovação:
                </p>
                <p class="whitespace-pre-line leading-relaxed">
                  {{ publicationDetails.rejectionReason }}
                </p>
              </div>

              <!-- Motivo de Falha no Instagram (se houver) -->
              <div
                v-if="publicationDetails.failureReason"
                class="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900"
              >
                <p class="font-bold mb-1 flex items-center gap-1.5 text-rose-700">
                  <AlertCircle class="w-4 h-4" />
                  Falha no envio pela API da Meta:
                </p>
                <p class="whitespace-pre-line leading-relaxed font-mono text-[11px]">
                  {{ publicationDetails.failureReason }}
                </p>
              </div>
            </div>

            <DialogFooter class="pt-2">
              <button
                type="button"
                @click="isDetailsDialogOpen = false"
                class="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 rounded-lg transition-colors font-medium text-xs"
              >
                Fechar
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
