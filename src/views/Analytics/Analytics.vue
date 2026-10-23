<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import {
  BarChart3,
  TrendingUp,
  Eye,
  Users,
  MessageCircle,
  Heart,
  Share2,
  Bookmark,
  Reply,
  Sparkles,
  Building2,
  Instagram,
  RefreshCw,
  AlertTriangle,
  Info,
  Calendar,
  ExternalLink,
  ArrowRight,
  Shield,
  Layers,
  Percent,
} from "lucide-vue-next";
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

interface CampaignOption {
  campaignId: string;
  name: string;
  status?: string;
  teamId?: string;
  teamName?: string;
}

interface PublicationOption {
  id: string;
  caption: string;
  format: "feed" | "story" | number;
  status: string;
  publishedAt?: string;
  createdAt?: string;
}

// Métricas de Campanha
interface CampaignInsightTotals {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
  replies: number | null;
  totalInteractions: number | null;
  engagementRate: number | null;
}

interface DailyInsight {
  date: string;
  views: number;
  reach: number;
  totalInteractions: number;
}

interface CampaignPublicationMetrics {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
  replies: number | null;
  totalInteractions: number | null;
  engagementRate: number | null;
  collectedAt?: string;
}

interface CampaignPublicationInsight {
  publicationId: string;
  postId: string;
  caption: string;
  format: "feed" | "story" | number;
  publishedAt: string;
  lastCollectedAt: string | null;
  metrics: CampaignPublicationMetrics | null;
}

interface CampaignInsightsResponse {
  campaignId: string;
  campaignName: string;
  publicationCount: number;
  totals: CampaignInsightTotals | null;
  publications: CampaignPublicationInsight[];
  daily: DailyInsight[];
}

// Métricas de Publicação
interface InsightPoint {
  collectedAt: string;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
  replies: number | null;
  totalInteractions: number | null;
}

interface PublicationInsightsResponse {
  publicationId: string;
  format: "feed" | "story" | number;
  status: string;
  publishedAt: string | null;
  lastCollectedAt: string | null;
  totals: (InsightPoint & { engagementRate: number | null }) | null;
  timeline: InsightPoint[];
}

// ==========================================
// ESTADO
// ==========================================
const teams = ref<UserTeam[]>([]);
const selectedTeamId = ref<string>("");
const instagramConnection = ref<InstagramConnection | null>(null);

const activeTab = ref<"campaign" | "publication">("campaign");

// Campanhas
const campaigns = ref<CampaignOption[]>([]);
const selectedCampaignId = ref<string>("");
const campaignInsights = ref<CampaignInsightsResponse | null>(null);
const isLoadingCampaignInsights = ref<boolean>(false);
const activeDailyMetric = ref<"views" | "reach" | "totalInteractions">("reach");

// Publicações
const publications = ref<PublicationOption[]>([]);
const selectedPublicationId = ref<string>("");
const publicationInsights = ref<PublicationInsightsResponse | null>(null);
const isLoadingPublicationInsights = ref<boolean>(false);

// Estados Gerais
const isLoadingTeams = ref<boolean>(true);
const isRefreshing = ref<boolean>(false);
const errorMessage = ref<string>("");

// Hover no gráfico
const hoveredDailyIndex = ref<number | null>(null);
const hoveredTimelineIndex = ref<number | null>(null);

// ==========================================
// COMPUTED PROPERTIES
// ==========================================
const currentTeam = computed(() =>
  teams.value.find((t) => t.teamId === selectedTeamId.value)
);

const isManager = computed(() => {
  const role = currentTeam.value?.role?.toLowerCase();
  return role === "owner" || role === "admin" || role === "dono" || role === "administrador";
});

const isInstagramConnected = computed(
  () => instagramConnection.value?.isConfigured === true
);

// Cálculos para Gráfico Diário de Campanhas (SVG)
const dailyChartData = computed(() => {
  if (!campaignInsights.value || !campaignInsights.value.daily || campaignInsights.value.daily.length === 0) {
    return null;
  }

  const items = campaignInsights.value.daily;
  const values = items.map((d) => d[activeDailyMetric.value] || 0);
  const maxVal = Math.max(...values, 1);
  const minVal = 0;

  const width = 650;
  const height = 200;
  const paddingX = 40;
  const paddingY = 25;

  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const points = items.map((item, index) => {
    const x = items.length === 1
      ? width / 2
      : paddingX + (index / (items.length - 1)) * chartW;
    const val = item[activeDailyMetric.value] || 0;
    const y = height - paddingY - (val / maxVal) * chartH;
    return { x, y, val, date: item.date, raw: item };
  });

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Área preenchida
  const areaStr = points.length > 0
    ? `${points[0].x},${height - paddingY} ${polylineStr} ${points[points.length - 1].x},${height - paddingY}`
    : "";

  return { width, height, paddingX, paddingY, points, polylineStr, areaStr, maxVal, minVal };
});

// Cálculos para Gráfico de Timeline de Publicações (SVG)
const timelineChartData = computed(() => {
  if (!publicationInsights.value || !publicationInsights.value.timeline || publicationInsights.value.timeline.length === 0) {
    return null;
  }

  const items = publicationInsights.value.timeline;
  const values = items.map((d) => d.totalInteractions ?? d.reach ?? d.views ?? 0);
  const maxVal = Math.max(...values, 1);

  const width = 650;
  const height = 180;
  const paddingX = 40;
  const paddingY = 25;

  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const points = items.map((item, index) => {
    const x = items.length === 1
      ? width / 2
      : paddingX + (index / (items.length - 1)) * chartW;
    const val = item.totalInteractions ?? item.reach ?? item.views ?? 0;
    const y = height - paddingY - (val / maxVal) * chartH;
    return { x, y, val, collectedAt: item.collectedAt, raw: item };
  });

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaStr = points.length > 0
    ? `${points[0].x},${height - paddingY} ${polylineStr} ${points[points.length - 1].x},${height - paddingY}`
    : "";

  return { width, height, points, polylineStr, areaStr, maxVal };
});

// ==========================================
// FUNÇÕES FORMATADORAS
// ==========================================
const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "-";
  return new Intl.NumberFormat("pt-BR").format(num);
};

const formatPercent = (rate: number | null | undefined): string => {
  if (rate === null || rate === undefined) return "-";
  // O backend pode retornar taxa em decimal (ex: 0.149 = 14.9%) ou já percentual
  const val = rate <= 1 ? rate * 100 : rate;
  return `${val.toFixed(1).replace(".", ",")}%`;
};

const formatDate = (isoString?: string | null): string => {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatDateTime = (isoString?: string | null): string => {
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

const formatDailyDate = (dateStr: string): string => {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
};

const formatFormatLabel = (fmt: "feed" | "story" | number): string => {
  if (fmt === "feed" || fmt === 1) return "Feed";
  if (fmt === "story" || fmt === 2) return "Story";
  return String(fmt);
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

const fetchTeams = async () => {
  isLoadingTeams.value = true;
  errorMessage.value = "";
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
      await handleTeamChange(initialId);
    } else {
      selectedTeamId.value = "";
      instagramConnection.value = { isConfigured: false, account: null };
      campaigns.value = [];
      publications.value = [];
    }
  } catch (err: any) {
    errorMessage.value = err.message || "Erro ao conectar ao servidor.";
  } finally {
    isLoadingTeams.value = false;
  }
};

const handleTeamChange = async (teamId: string) => {
  if (!teamId) return;
  localStorage.setItem("@MktApp:selectedTeamId", teamId);
  await Promise.all([
    fetchInstagramConnection(teamId),
    fetchCampaigns(teamId),
    fetchPublishedPublications(teamId),
  ]);
  if (activeTab.value === "campaign") {
    await fetchCampaignInsights();
  } else {
    await fetchPublicationInsights();
  }
};

const fetchInstagramConnection = async (teamId: string) => {
  if (!teamId) {
    instagramConnection.value = { isConfigured: false, account: null };
    return;
  }
  try {
    const response = await apiFetch(`/teams/${teamId}/social/instagram`);
    if (response.ok) {
      const data: InstagramConnection = await response.json();
      instagramConnection.value = data;
    } else {
      instagramConnection.value = { isConfigured: false, account: null };
    }
  } catch {
    instagramConnection.value = { isConfigured: false, account: null };
  }
};

const fetchCampaigns = async (teamId: string) => {
  if (!teamId) {
    campaigns.value = [];
    selectedCampaignId.value = "";
    campaignInsights.value = null;
    return;
  }
  try {
    const response = await apiFetch(`/workflow/teams/${teamId}/campaigns`);
    if (response.ok) {
      const data = await response.json();
      const rawCampaigns = data.campaigns || (Array.isArray(data) ? data : []);
      campaigns.value = rawCampaigns.map((c: any) => ({
        campaignId: c.campaignId || c.id,
        name: c.name || c.campaignName || "Campanha sem nome",
        status: c.status,
      }));
      if (campaigns.value.length > 0) {
        selectedCampaignId.value = campaigns.value[0].campaignId;
      } else {
        selectedCampaignId.value = "";
        campaignInsights.value = null;
      }
    } else {
      campaigns.value = [];
      selectedCampaignId.value = "";
      campaignInsights.value = null;
    }
  } catch {
    campaigns.value = [];
    selectedCampaignId.value = "";
    campaignInsights.value = null;
  }
};

const fetchPublishedPublications = async (teamId: string) => {
  if (!teamId) {
    publications.value = [];
    selectedPublicationId.value = "";
    publicationInsights.value = null;
    return;
  }
  try {
    const response = await apiFetch(`/teams/${teamId}/social/instagram/publications`);
    if (response.ok) {
      const data = await response.json();
      const items: any[] = data.items || data.publications || (Array.isArray(data) ? data : []);
      publications.value = items.filter(
        (p) => String(p.status).toLowerCase() === "published"
      );
      if (publications.value.length > 0) {
        selectedPublicationId.value = publications.value[0].id;
      } else {
        selectedPublicationId.value = "";
        publicationInsights.value = null;
      }
    } else {
      publications.value = [];
      selectedPublicationId.value = "";
      publicationInsights.value = null;
    }
  } catch {
    publications.value = [];
    selectedPublicationId.value = "";
    publicationInsights.value = null;
  }
};

const fetchCampaignInsights = async () => {
  if (!selectedTeamId.value || !selectedCampaignId.value) {
    campaignInsights.value = null;
    return;
  }

  isLoadingCampaignInsights.value = true;
  errorMessage.value = "";

  try {
    const response = await apiFetch(
      `/teams/${selectedTeamId.value}/social/instagram/campaigns/${selectedCampaignId.value}/insights`
    );

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao consultar métricas da campanha."));
    }

    const data: CampaignInsightsResponse = await response.json();
    campaignInsights.value = data;
  } catch (err: any) {
    errorMessage.value = err.message || "Falha ao carregar métricas da campanha.";
    campaignInsights.value = null;
  } finally {
    isLoadingCampaignInsights.value = false;
  }
};

const fetchPublicationInsights = async () => {
  if (!selectedTeamId.value || !selectedPublicationId.value) {
    publicationInsights.value = null;
    return;
  }

  isLoadingPublicationInsights.value = true;
  errorMessage.value = "";

  try {
    const response = await apiFetch(
      `/teams/${selectedTeamId.value}/social/instagram/publications/${selectedPublicationId.value}/insights`
    );

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao consultar métricas da publicação."));
    }

    const data: PublicationInsightsResponse = await response.json();
    publicationInsights.value = data;
  } catch (err: any) {
    errorMessage.value = err.message || "Falha ao carregar métricas da publicação.";
    publicationInsights.value = null;
  } finally {
    isLoadingPublicationInsights.value = false;
  }
};

const handleRefresh = async () => {
  isRefreshing.value = true;
  try {
    if (activeTab.value === "campaign") {
      await fetchCampaignInsights();
    } else {
      await fetchPublicationInsights();
    }
  } finally {
    isRefreshing.value = false;
  }
};

// Drill-down: da tabela da campanha para a aba da publicação
const drillDownToPublication = (publicationId: string) => {
  selectedPublicationId.value = publicationId;
  activeTab.value = "publication";
  fetchPublicationInsights();
};

// ==========================================
// WATCHERS & CICLO DE VIDA
// ==========================================
watch(selectedTeamId, async (newTeamId) => {
  if (!newTeamId) return;
  await handleTeamChange(newTeamId);
});

watch(selectedCampaignId, () => {
  if (activeTab.value === "campaign") {
    fetchCampaignInsights();
  }
});

watch(selectedPublicationId, () => {
  if (activeTab.value === "publication") {
    fetchPublicationInsights();
  }
});

watch(activeTab, (tab) => {
  if (tab === "campaign" && selectedCampaignId.value) {
    fetchCampaignInsights();
  } else if (tab === "publication" && selectedPublicationId.value) {
    fetchPublicationInsights();
  }
});

onMounted(async () => {
  await fetchTeams();
});
</script>

<template>
  <div class="flex min-h-screen bg-gray-50">
    <AppSidebar />

    <div class="flex-1 overflow-auto">
      <div class="p-8 max-w-7xl mx-auto space-y-6">

        <!-- ========================================== -->
        <!-- CABEÇALHO & SELEÇÃO DE EQUIPE -->
        <!-- ========================================== -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div class="flex items-center space-x-3 mb-1">
                <div class="p-2 bg-soft-green/30 rounded-lg text-vibrant-green">
                  <BarChart3 class="w-6 h-6" />
                </div>
                <h1 class="text-2xl font-bold text-gray-900">Relatórios & Métricas</h1>
              </div>
              <p class="text-sm text-gray-500">
                Acompanhe o alcance, engajamento e a evolução das suas campanhas e publicações no Instagram
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
                :disabled="isRefreshing || !selectedTeamId"
                class="flex items-center space-x-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                title="Recarregar métricas"
              >
                <RefreshCw :class="['w-4 h-4', { 'animate-spin': isRefreshing }]" />
                <span class="hidden sm:inline">Atualizar</span>
              </button>
            </div>
          </div>

          <!-- Status Instagram da Equipe -->
          <div class="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div v-if="isInstagramConnected && instagramConnection?.account" class="flex items-center space-x-2 text-sm text-gray-700">
              <Instagram class="w-4 h-4 text-pink-600" />
              <span>Conta vinculada:</span>
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
                Ativo
              </span>
            </div>

            <div v-else class="flex items-center space-x-2 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
              <AlertTriangle class="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Instagram não conectado nesta equipe.</span>
              <button
                @click="router.push('/settings')"
                class="font-semibold underline hover:text-amber-900 ml-1"
              >
                Configurar agora
              </button>
            </div>

            <!-- Fuso Horário informativo -->
            <div class="text-xs text-gray-400 flex items-center space-x-1">
              <Calendar class="w-3.5 h-3.5" />
              <span>Métricas diárias consolidadas no Horário de Brasília</span>
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
        <!-- NAVEGAÇÃO DE ABAS: POR CAMPANHA / POR POST -->
        <!-- ========================================== -->
        <div class="flex items-center justify-between border-b border-gray-200">
          <div class="flex space-x-8">
            <button
              @click="activeTab = 'campaign'"
              :class="[
                'flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'campaign'
                  ? 'border-vibrant-green text-vibrant-green'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              <Building2 class="w-4 h-4" />
              <span>Desempenho por Campanha</span>
            </button>

            <button
              @click="activeTab = 'publication'"
              :class="[
                'flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'publication'
                  ? 'border-vibrant-green text-vibrant-green'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              <Share2 class="w-4 h-4" />
              <span>Desempenho por Publicação</span>
            </button>
          </div>
        </div>

        <!-- ========================================== -->
        <!-- ABA 1: DESEMPENHO POR CAMPANHA -->
        <!-- ========================================== -->
        <div v-if="activeTab === 'campaign'" class="space-y-6">

          <!-- Barra de Filtro de Campanha -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center space-x-3 w-full sm:w-auto">
              <label class="text-sm font-semibold text-gray-700 whitespace-nowrap">Campanha:</label>
              <select
                v-model="selectedCampaignId"
                class="w-full sm:w-80 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-vibrant-green focus:border-vibrant-green p-2 font-medium"
              >
                <option v-if="campaigns.length === 0" value="">Nenhuma campanha encontrada</option>
                <option v-for="camp in campaigns" :key="camp.campaignId" :value="camp.campaignId">
                  {{ camp.name }}
                </option>
              </select>
            </div>

            <div v-if="campaignInsights" class="flex items-center space-x-2 text-xs text-gray-500">
              <span class="inline-flex items-center px-2.5 py-1 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {{ campaignInsights.publicationCount }} {{ campaignInsights.publicationCount === 1 ? 'publicação veiculada' : 'publicações veiculadas' }}
              </span>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="isLoadingCampaignInsights" class="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
            <div v-for="i in 4" :key="i" class="bg-white h-32 rounded-xl border border-gray-200"></div>
          </div>

          <!-- Empty State: Nenhuma Publicação na Campanha -->
          <div
            v-else-if="campaignInsights && campaignInsights.publicationCount === 0"
            class="bg-white rounded-xl border border-gray-200 p-12 text-center"
          >
            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <BarChart3 class="w-8 h-8" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-1">Sem publicações ativas no Instagram</h3>
            <p class="text-sm text-gray-500 max-w-md mx-auto mb-6">
              Esta campanha ainda não possui publicações veiculadas no Instagram. Assim que uma postagem for aprovada e postada, as métricas de alcance e interações serão computadas aqui.
            </p>
            <button
              @click="router.push('/publications')"
              class="inline-flex items-center space-x-2 px-4 py-2 bg-vibrant-green text-white rounded-lg text-sm font-semibold hover:bg-opacity-90 transition-colors shadow-sm"
            >
              <span>Ir para Publicações</span>
              <ArrowRight class="w-4 h-4" />
            </button>
          </div>

          <!-- Estado com Métricas Disponíveis -->
          <div v-else-if="campaignInsights" class="space-y-6">

            <!-- KPI Cards Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <!-- Alcance -->
              <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Alcance Total</span>
                  <div class="p-2 bg-purple-50 text-purple-600 rounded-lg">
                    <Users class="w-4 h-4" />
                  </div>
                </div>
                <div class="text-2xl font-bold text-gray-900">
                  {{ formatNumber(campaignInsights.totals?.reach) }}
                </div>
                <p class="text-xs text-gray-500 mt-1">Contas únicas que visualizaram</p>
              </div>

              <!-- Visualizações -->
              <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Visualizações</span>
                  <div class="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Eye class="w-4 h-4" />
                  </div>
                </div>
                <div class="text-2xl font-bold text-gray-900">
                  {{ formatNumber(campaignInsights.totals?.views) }}
                </div>
                <p class="text-xs text-gray-500 mt-1">Total de impressões acumuladas</p>
              </div>

              <!-- Interações Totais -->
              <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Interações Totais</span>
                  <div class="p-2 bg-green-50 text-vibrant-green rounded-lg">
                    <Sparkles class="w-4 h-4" />
                  </div>
                </div>
                <div class="text-2xl font-bold text-gray-900">
                  {{ formatNumber(campaignInsights.totals?.totalInteractions) }}
                </div>
                <p class="text-xs text-gray-500 mt-1">Curtidas, comentários, salvos, etc.</p>
              </div>

              <!-- Taxa de Engajamento -->
              <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Engajamento</span>
                  <div class="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Percent class="w-4 h-4" />
                  </div>
                </div>
                <div class="text-2xl font-bold text-gray-900">
                  {{ formatPercent(campaignInsights.totals?.engagementRate) }}
                </div>
                <p class="text-xs text-gray-500 mt-1">Interações em relação ao alcance</p>
              </div>
            </div>

            <!-- Breakdown de Tipos de Interação -->
            <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 class="text-sm font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Layers class="w-4 h-4 text-vibrant-green" />
                <span>Detalhamento de Interações na Campanha</span>
              </h3>

              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center space-x-3">
                  <div class="p-2 bg-red-100 text-red-600 rounded-md">
                    <Heart class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="text-xs text-gray-500">Curtidas</div>
                    <div class="text-lg font-bold text-gray-800">
                      {{ formatNumber(campaignInsights.totals?.likes) }}
                    </div>
                  </div>
                </div>

                <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center space-x-3">
                  <div class="p-2 bg-blue-100 text-blue-600 rounded-md">
                    <MessageCircle class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="text-xs text-gray-500">Comentários</div>
                    <div class="text-lg font-bold text-gray-800">
                      {{ formatNumber(campaignInsights.totals?.comments) }}
                    </div>
                  </div>
                </div>

                <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center space-x-3">
                  <div class="p-2 bg-purple-100 text-purple-600 rounded-md">
                    <Share2 class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="text-xs text-gray-500">Compartilhamentos</div>
                    <div class="text-lg font-bold text-gray-800">
                      {{ formatNumber(campaignInsights.totals?.shares) }}
                    </div>
                  </div>
                </div>

                <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center space-x-3">
                  <div class="p-2 bg-amber-100 text-amber-600 rounded-md">
                    <Bookmark class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="text-xs text-gray-500">Salvos</div>
                    <div class="text-lg font-bold text-gray-800">
                      {{ formatNumber(campaignInsights.totals?.saved) }}
                    </div>
                  </div>
                </div>

                <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center space-x-3">
                  <div class="p-2 bg-indigo-100 text-indigo-600 rounded-md">
                    <Reply class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="text-xs text-gray-500">Respostas (Stories)</div>
                    <div class="text-lg font-bold text-gray-800">
                      {{ formatNumber(campaignInsights.totals?.replies) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Gráfico de Evolução Diária (SVG) -->
            <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 class="text-base font-semibold text-gray-900 flex items-center space-x-2">
                    <TrendingUp class="w-5 h-5 text-vibrant-green" />
                    <span>Evolução Diária de Desempenho</span>
                  </h3>
                  <p class="text-xs text-gray-500 mt-0.5">
                    Ganhos diários agregados de todas as publicações da campanha (Horário de Brasília)
                  </p>
                </div>

                <!-- Seletor de Métrica do Gráfico -->
                <div class="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
                  <button
                    @click="activeDailyMetric = 'reach'"
                    :class="[
                      'px-3 py-1 text-xs font-semibold rounded-md transition-colors',
                      activeDailyMetric === 'reach'
                        ? 'bg-white text-purple-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    ]"
                  >
                    Alcance
                  </button>
                  <button
                    @click="activeDailyMetric = 'views'"
                    :class="[
                      'px-3 py-1 text-xs font-semibold rounded-md transition-colors',
                      activeDailyMetric === 'views'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    ]"
                  >
                    Visualizações
                  </button>
                  <button
                    @click="activeDailyMetric = 'totalInteractions'"
                    :class="[
                      'px-3 py-1 text-xs font-semibold rounded-md transition-colors',
                      activeDailyMetric === 'totalInteractions'
                        ? 'bg-white text-vibrant-green shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    ]"
                  >
                    Interações
                  </button>
                </div>
              </div>

              <!-- Renderização Gráfica -->
              <div v-if="dailyChartData && dailyChartData.points.length > 0" class="w-full">
                <div class="relative overflow-x-auto">
                  <svg
                    :viewBox="`0 0 ${dailyChartData.width} ${dailyChartData.height}`"
                    class="w-full h-56 select-none"
                  >
                    <defs>
                      <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#10B981" stop-opacity="0.28" />
                        <stop offset="100%" stop-color="#10B981" stop-opacity="0.0" />
                      </linearGradient>
                    </defs>

                    <!-- Linhas de Grade Horizontais -->
                    <line
                      x1="30"
                      :y1="dailyChartData.height - 25"
                      :x2="dailyChartData.width - 30"
                      :y2="dailyChartData.height - 25"
                      stroke="#E5E7EB"
                      stroke-dasharray="3 3"
                    />
                    <line
                      x1="30"
                      :y1="dailyChartData.height / 2"
                      :x2="dailyChartData.width - 30"
                      :y2="dailyChartData.height / 2"
                      stroke="#F3F4F6"
                      stroke-dasharray="3 3"
                    />

                    <!-- Área Preenchida com Gradiente -->
                    <polygon
                      :points="dailyChartData.areaStr"
                      fill="url(#dailyGradient)"
                    />

                    <!-- Linha do Gráfico -->
                    <polyline
                      :points="dailyChartData.polylineStr"
                      fill="none"
                      stroke="#10B981"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />

                    <!-- Pontos no Gráfico -->
                    <g v-for="(p, i) in dailyChartData.points" :key="i">
                      <circle
                        :cx="p.x"
                        :cy="p.y"
                        :r="hoveredDailyIndex === i ? 6 : 4"
                        :fill="hoveredDailyIndex === i ? '#047857' : '#10B981'"
                        stroke="#FFFFFF"
                        stroke-width="2"
                        class="cursor-pointer transition-all"
                        @mouseenter="hoveredDailyIndex = i"
                        @mouseleave="hoveredDailyIndex = null"
                      />

                      <!-- Rótulos de Data no Eixo X -->
                      <text
                        :x="p.x"
                        :y="dailyChartData.height - 8"
                        text-anchor="middle"
                        class="text-[11px] fill-gray-400 font-medium"
                      >
                        {{ formatDailyDate(p.date) }}
                      </text>
                    </g>
                  </svg>
                </div>

                <!-- Detalhes do Ponto Selecionado / Hover -->
                <div v-if="hoveredDailyIndex !== null" class="mt-2 text-center bg-gray-50 py-2 rounded-lg border border-gray-200">
                  <span class="text-xs font-semibold text-gray-500">
                    Dia {{ formatDate(dailyChartData.points[hoveredDailyIndex].date) }}:
                  </span>
                  <span class="ml-2 text-sm font-bold text-gray-900">
                    {{ formatNumber(dailyChartData.points[hoveredDailyIndex].val) }}
                    {{
                      activeDailyMetric === 'reach'
                        ? 'contas alcançadas'
                        : activeDailyMetric === 'views'
                        ? 'visualizações'
                        : 'interações'
                    }}
                  </span>
                </div>
              </div>

              <div v-else class="py-12 text-center text-sm text-gray-400">
                Histórico diário ainda não disponível para este período.
              </div>
            </div>

            <!-- Tabela Comparativa de Publicações da Campanha -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div class="p-5 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 class="text-base font-semibold text-gray-900">
                    Publicações da Campanha ({{ campaignInsights.publications.length }})
                  </h3>
                  <p class="text-xs text-gray-500 mt-0.5">
                    Compare o desempenho individual de cada postagem veiculada
                  </p>
                </div>
              </div>

              <div class="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow class="bg-gray-50/50">
                      <TableHead class="font-semibold text-gray-700">Publicação</TableHead>
                      <TableHead class="font-semibold text-gray-700">Formato</TableHead>
                      <TableHead class="font-semibold text-gray-700">Data</TableHead>
                      <TableHead class="font-semibold text-gray-700 text-right">Alcance</TableHead>
                      <TableHead class="font-semibold text-gray-700 text-right">Visualizações</TableHead>
                      <TableHead class="font-semibold text-gray-700 text-right">Interações</TableHead>
                      <TableHead class="font-semibold text-gray-700 text-right">Engajamento</TableHead>
                      <TableHead class="font-semibold text-gray-700 text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow
                      v-for="pub in campaignInsights.publications"
                      :key="pub.publicationId"
                      class="hover:bg-gray-50/80 transition-colors"
                    >
                      <TableCell class="max-w-xs truncate">
                        <span class="font-medium text-gray-900 block truncate" :title="pub.caption">
                          {{ pub.caption || 'Sem legenda' }}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span
                          :class="[
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
                            pub.format === 'story' || pub.format === 2
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          ]"
                        >
                          {{ formatFormatLabel(pub.format) }}
                        </span>
                      </TableCell>

                      <TableCell class="text-xs text-gray-600 whitespace-nowrap">
                        {{ formatDate(pub.publishedAt) }}
                      </TableCell>

                      <TableCell class="text-right font-medium text-gray-900">
                        {{ formatNumber(pub.metrics?.reach) }}
                      </TableCell>

                      <TableCell class="text-right font-medium text-gray-900">
                        {{ formatNumber(pub.metrics?.views) }}
                      </TableCell>

                      <TableCell class="text-right font-medium text-gray-900">
                        {{ formatNumber(pub.metrics?.totalInteractions) }}
                      </TableCell>

                      <TableCell class="text-right font-semibold text-emerald-700">
                        {{ formatPercent(pub.metrics?.engagementRate) }}
                      </TableCell>

                      <TableCell class="text-center">
                        <button
                          @click="drillDownToPublication(pub.publicationId)"
                          class="inline-flex items-center space-x-1 text-xs font-semibold text-vibrant-green hover:underline py-1 px-2.5 bg-soft-green/30 rounded-lg hover:bg-soft-green/50 transition-colors"
                        >
                          <span>Ver Linha do Tempo</span>
                          <ArrowRight class="w-3 h-3" />
                        </button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

          </div>

        </div>

        <!-- ========================================== -->
        <!-- ABA 2: DESEMPENHO POR PUBLICAÇÃO -->
        <!-- ========================================== -->
        <div v-else-if="activeTab === 'publication'" class="space-y-6">

          <!-- Barra de Seleção de Publicação -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center space-x-3 w-full sm:w-auto">
              <label class="text-sm font-semibold text-gray-700 whitespace-nowrap">Publicação:</label>
              <select
                v-model="selectedPublicationId"
                class="w-full sm:w-96 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-vibrant-green focus:border-vibrant-green p-2 font-medium"
              >
                <option v-if="publications.length === 0" value="">Nenhuma publicação veiculada encontrada</option>
                <option v-for="pub in publications" :key="pub.id" :value="pub.id">
                  [{{ formatFormatLabel(pub.format) }}] {{ pub.caption ? (pub.caption.slice(0, 45) + (pub.caption.length > 45 ? '...' : '')) : 'Sem legenda' }} - {{ formatDate(pub.publishedAt || pub.createdAt) }}
                </option>
              </select>
            </div>

            <div v-if="publicationInsights" class="flex items-center space-x-2 text-xs text-gray-500">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Publicado
              </span>
              <span v-if="publicationInsights.lastCollectedAt">
                Última coleta: {{ formatDateTime(publicationInsights.lastCollectedAt) }}
              </span>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="isLoadingPublicationInsights" class="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
            <div v-for="i in 4" :key="i" class="bg-white h-32 rounded-xl border border-gray-200"></div>
          </div>

          <!-- Empty State: Sem dados da publicação -->
          <div
            v-else-if="!selectedPublicationId || publications.length === 0"
            class="bg-white rounded-xl border border-gray-200 p-12 text-center"
          >
            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Share2 class="w-8 h-8" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-1">Nenhuma publicação veiculada</h3>
            <p class="text-sm text-gray-500 max-w-md mx-auto mb-6">
              Apenas publicações com status "Publicada" possuem métricas coletadas pela API da Meta.
            </p>
            <button
              @click="router.push('/publications')"
              class="inline-flex items-center space-x-2 px-4 py-2 bg-vibrant-green text-white rounded-lg text-sm font-semibold hover:bg-opacity-90 transition-colors shadow-sm"
            >
              <span>Gerenciar Publicações</span>
              <ArrowRight class="w-4 h-4" />
            </button>
          </div>

          <!-- Estado com Publicação Selecionada -->
          <div v-else-if="publicationInsights" class="space-y-6">

            <!-- Empty State de Coletas Pendentes -->
            <div
              v-if="!publicationInsights.totals"
              class="p-6 bg-blue-50 border border-blue-200 rounded-xl flex items-start space-x-4"
            >
              <Info class="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 class="text-sm font-bold text-blue-900">Coleta de Métricas em Processamento</h4>
                <p class="text-xs text-blue-700 mt-1 leading-relaxed">
                  Esta publicação foi enviada recentemente para o Instagram. O robô de monitoramento coleta as primeiras métricas após algumas horas da veiculação.
                  Posts do Feed são monitorados por 30 dias e Stories por 24 horas.
                </p>
              </div>
            </div>

            <!-- Totais Consolidados do Post -->
            <div v-else class="space-y-6">

              <!-- KPI Cards Grid -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <!-- Alcance -->
                <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Alcance</span>
                    <div class="p-2 bg-purple-50 text-purple-600 rounded-lg">
                      <Users class="w-4 h-4" />
                    </div>
                  </div>
                  <div class="text-2xl font-bold text-gray-900">
                    {{ formatNumber(publicationInsights.totals.reach) }}
                  </div>
                  <p class="text-xs text-gray-500 mt-1">Contas únicas que visualizaram</p>
                </div>

                <!-- Visualizações -->
                <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Visualizações</span>
                    <div class="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <Eye class="w-4 h-4" />
                    </div>
                  </div>
                  <div class="text-2xl font-bold text-gray-900">
                    {{ formatNumber(publicationInsights.totals.views) }}
                  </div>
                  <p class="text-xs text-gray-500 mt-1">Impressões totais registradas</p>
                </div>

                <!-- Interações Totais -->
                <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total de Interações</span>
                    <div class="p-2 bg-green-50 text-vibrant-green rounded-lg">
                      <Sparkles class="w-4 h-4" />
                    </div>
                  </div>
                  <div class="text-2xl font-bold text-gray-900">
                    {{ formatNumber(publicationInsights.totals.totalInteractions) }}
                  </div>
                  <p class="text-xs text-gray-500 mt-1">Ações realizadas pelo público</p>
                </div>

                <!-- Taxa de Engajamento -->
                <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Engajamento</span>
                    <div class="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <Percent class="w-4 h-4" />
                    </div>
                  </div>
                  <div class="text-2xl font-bold text-gray-900">
                    {{ formatPercent(publicationInsights.totals.engagementRate) }}
                  </div>
                  <p class="text-xs text-gray-500 mt-1">Interações / Alcance</p>
                </div>
              </div>

              <!-- Detalhamento de Métricas do Formato -->
              <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 class="text-sm font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <Layers class="w-4 h-4 text-vibrant-green" />
                  <span>Métricas Detalhadas do Formato ({{ formatFormatLabel(publicationInsights.format) }})</span>
                </h3>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <!-- Se for Feed: Curtidas, Comentários, Compartilhamentos, Salvos -->
                  <template v-if="publicationInsights.format === 'feed' || publicationInsights.format === 1">
                    <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center space-x-3">
                      <div class="p-2 bg-red-100 text-red-600 rounded-md">
                        <Heart class="w-4 h-4" />
                      </div>
                      <div>
                        <div class="text-xs text-gray-500">Curtidas</div>
                        <div class="text-lg font-bold text-gray-800">
                          {{ formatNumber(publicationInsights.totals.likes) }}
                        </div>
                      </div>
                    </div>

                    <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center space-x-3">
                      <div class="p-2 bg-blue-100 text-blue-600 rounded-md">
                        <MessageCircle class="w-4 h-4" />
                      </div>
                      <div>
                        <div class="text-xs text-gray-500">Comentários</div>
                        <div class="text-lg font-bold text-gray-800">
                          {{ formatNumber(publicationInsights.totals.comments) }}
                        </div>
                      </div>
                    </div>

                    <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center space-x-3">
                      <div class="p-2 bg-purple-100 text-purple-600 rounded-md">
                        <Share2 class="w-4 h-4" />
                      </div>
                      <div>
                        <div class="text-xs text-gray-500">Compartilhamentos</div>
                        <div class="text-lg font-bold text-gray-800">
                          {{ formatNumber(publicationInsights.totals.shares) }}
                        </div>
                      </div>
                    </div>

                    <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center space-x-3">
                      <div class="p-2 bg-amber-100 text-amber-600 rounded-md">
                        <Bookmark class="w-4 h-4" />
                      </div>
                      <div>
                        <div class="text-xs text-gray-500">Salvos</div>
                        <div class="text-lg font-bold text-gray-800">
                          {{ formatNumber(publicationInsights.totals.saved) }}
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- Se for Story: Respostas e Compartilhamentos -->
                  <template v-else>
                    <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center space-x-3">
                      <div class="p-2 bg-indigo-100 text-indigo-600 rounded-md">
                        <Reply class="w-4 h-4" />
                      </div>
                      <div>
                        <div class="text-xs text-gray-500">Respostas no Story</div>
                        <div class="text-lg font-bold text-gray-800">
                          {{ formatNumber(publicationInsights.totals.replies) }}
                        </div>
                      </div>
                    </div>

                    <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center space-x-3">
                      <div class="p-2 bg-purple-100 text-purple-600 rounded-md">
                        <Share2 class="w-4 h-4" />
                      </div>
                      <div>
                        <div class="text-xs text-gray-500">Compartilhamentos</div>
                        <div class="text-lg font-bold text-gray-800">
                          {{ formatNumber(publicationInsights.totals.shares) }}
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Linha do Tempo de Coletas (Snapshots) -->
              <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div class="mb-6">
                  <h3 class="text-base font-semibold text-gray-900 flex items-center space-x-2">
                    <TrendingUp class="w-5 h-5 text-vibrant-green" />
                    <span>Linha do Tempo de Coletas Periódicas</span>
                  </h3>
                  <p class="text-xs text-gray-500 mt-0.5">
                    Histórico de evolução das métricas capturadas pela sincronização com a Meta API
                  </p>
                </div>

                <!-- Gráfico de Evolução dos Snapshots -->
                <div v-if="timelineChartData && timelineChartData.points.length > 1" class="mb-6">
                  <div class="relative overflow-x-auto">
                    <svg
                      :viewBox="`0 0 ${timelineChartData.width} ${timelineChartData.height}`"
                      class="w-full h-44 select-none"
                    >
                      <defs>
                        <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.25" />
                          <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.0" />
                        </linearGradient>
                      </defs>

                      <polygon
                        :points="timelineChartData.areaStr"
                        fill="url(#timelineGradient)"
                      />

                      <polyline
                        :points="timelineChartData.polylineStr"
                        fill="none"
                        stroke="#3B82F6"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />

                      <g v-for="(p, i) in timelineChartData.points" :key="i">
                        <circle
                          :cx="p.x"
                          :cy="p.y"
                          :r="hoveredTimelineIndex === i ? 5 : 3.5"
                          :fill="hoveredTimelineIndex === i ? '#1D4ED8' : '#3B82F6'"
                          stroke="#FFFFFF"
                          stroke-width="1.5"
                          class="cursor-pointer transition-all"
                          @mouseenter="hoveredTimelineIndex = i"
                          @mouseleave="hoveredTimelineIndex = null"
                        />
                      </g>
                    </svg>
                  </div>
                </div>

                <!-- Tabela de Snapshots -->
                <div class="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow class="bg-gray-50/50">
                        <TableHead class="font-semibold text-gray-700">Data/Hora da Coleta</TableHead>
                        <TableHead class="font-semibold text-gray-700 text-right">Alcance</TableHead>
                        <TableHead class="font-semibold text-gray-700 text-right">Visualizações</TableHead>
                        <TableHead class="font-semibold text-gray-700 text-right">Interações Totais</TableHead>
                        <TableHead v-if="publicationInsights.format === 'feed' || publicationInsights.format === 1" class="font-semibold text-gray-700 text-right">Curtidas</TableHead>
                        <TableHead v-if="publicationInsights.format === 'feed' || publicationInsights.format === 1" class="font-semibold text-gray-700 text-right">Comentários</TableHead>
                        <TableHead v-if="publicationInsights.format === 'story' || publicationInsights.format === 2" class="font-semibold text-gray-700 text-right">Respostas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow
                        v-for="(snapshot, index) in publicationInsights.timeline"
                        :key="index"
                        class="hover:bg-gray-50/80 transition-colors"
                      >
                        <TableCell class="text-xs text-gray-800 font-medium whitespace-nowrap">
                          {{ formatDateTime(snapshot.collectedAt) }}
                        </TableCell>

                        <TableCell class="text-right font-medium text-gray-900">
                          {{ formatNumber(snapshot.reach) }}
                        </TableCell>

                        <TableCell class="text-right font-medium text-gray-900">
                          {{ formatNumber(snapshot.views) }}
                        </TableCell>

                        <TableCell class="text-right font-semibold text-emerald-700">
                          {{ formatNumber(snapshot.totalInteractions) }}
                        </TableCell>

                        <TableCell v-if="publicationInsights.format === 'feed' || publicationInsights.format === 1" class="text-right text-gray-700">
                          {{ formatNumber(snapshot.likes) }}
                        </TableCell>

                        <TableCell v-if="publicationInsights.format === 'feed' || publicationInsights.format === 1" class="text-right text-gray-700">
                          {{ formatNumber(snapshot.comments) }}
                        </TableCell>

                        <TableCell v-if="publicationInsights.format === 'story' || publicationInsights.format === 2" class="text-right text-gray-700">
                          {{ formatNumber(snapshot.replies) }}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  </div>
</template>
