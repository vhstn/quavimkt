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
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Save,
  Eye,
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
// CONSTANTES & LIMITES
// ==========================================
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg"];
const MAX_CAPTION_LENGTH = 2200; // Limite máximo da API do Instagram

// ==========================================
// INTERFACES
// ==========================================
interface CampaignOption {
  campaignId: string;
  name: string;
  teamId: string;
  teamName: string;
}

interface MediaInfo {
  id: string;
  fileName: string;
}

interface PostAsset {
  media: MediaInfo;
  sequenceOrder: number;
}

interface PostItem {
  id: string;
  caption: string;
  createdAt: string;
  status: string;
  assets: PostAsset[];
}

interface EditableAsset {
  mediaId: string;
  fileName: string;
  sequenceOrder: number;
  replacementFile?: File;
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

// ==========================================
// ESTADO: Edição de Postagem
// ==========================================
const isEditPostDialogOpen = ref(false);
const editingPost = ref<PostItem | null>(null);
const editCaption = ref("");
const editableAssets = ref<EditableAsset[]>([]);
const assetsToRemove = ref<string[]>([]);
const editNewFiles = ref<File[]>([]);
const isSavingEdit = ref(false);
const saveStatusMessage = ref("");

// ==========================================
// ESTADO: Listagem de Postagens
// ==========================================
const posts = ref<PostItem[]>([]);
const totalCount = ref(0);
const isFetching = ref(true);
const isAssetsDialogOpen = ref(false);
const selectedAssets = ref<PostAsset[]>([]);
const isDownloading = ref<Record<string, boolean>>({});

// ==========================================
// ESTADO: Prévia Ampliada de Imagens (Lightbox)
// ==========================================
const isPreviewDialogOpen = ref(false);
const previewImageUrl = ref("");
const previewImageTitle = ref("");

const openImagePreview = (url: string, title = "Visualização da Imagem") => {
  if (!url) return;
  previewImageUrl.value = url;
  previewImageTitle.value = title;
  isPreviewDialogOpen.value = true;
};

const getMediaPublicUrl = (mediaId?: string) => {
  if (!mediaId) return "";
  return `${import.meta.env.VITE_RENDER_API_URL}/media/public/${mediaId}`;
};

const getFilePreviewUrl = (file: File) => {
  try {
    return URL.createObjectURL(file);
  } catch {
    return "";
  }
};

// ==========================================
// ESTADO: Modais de Feedback
// ==========================================
const errorMessage = ref("");
const isErrorDialogOpen = ref(false);
const isSuccessDialogOpen = ref(false);
const successTitle = ref("Postagem Criada!");
const successMessage = ref("Sua postagem e imagens foram salvas com sucesso.");

const showSuccess = (msg: string, title = "Sucesso!") => {
  successTitle.value = title;
  successMessage.value = msg;
  isSuccessDialogOpen.value = true;
};

const getToken = () => localStorage.getItem("@MktApp:token");

// ==========================================
// UTILITÁRIOS
// ==========================================
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

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

const throwApiError = async (response: Response) => {
  const rawText = await response.text();
  let apiMessage = "Erro interno no servidor.";
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
};

const showError = (msg: string) => {
  errorMessage.value = msg;
  isErrorDialogOpen.value = true;
};

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
    posts.value = data.items || data.posts || (Array.isArray(data) ? data : []);
    totalCount.value =
      typeof data.totalCount === "number" ? data.totalCount : posts.value.length;
  } catch (error: any) {
    showError(error.message);
  } finally {
    isFetching.value = false;
  }
};

const viewAssets = (assets: PostAsset[]) => {
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
  if (!input.files || input.files.length === 0) return;

  const filesToAdd: File[] = [];
  const errors: string[] = [];

  for (const file of Array.from(input.files)) {
    const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      errors.push(`"${file.name}": Formato inválido. Apenas imagens JPEG (.jpg ou .jpeg) são permitidas.`);
      continue;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push(`"${file.name}": O arquivo excede o limite máximo de 8 MB (${formatFileSize(file.size)}).`);
      continue;
    }

    if (file.size === 0) {
      errors.push(`"${file.name}": O arquivo está vazio.`);
      continue;
    }

    filesToAdd.push(file);
  }

  if (errors.length > 0) {
    showError(errors.join("\n"));
  }

  if (filesToAdd.length > 0) {
    selectedFiles.value = [...selectedFiles.value, ...filesToAdd];
  }

  input.value = "";
};

const removeFile = (index: number) => {
  selectedFiles.value.splice(index, 1);
};

const handleSubmit = async () => {
  if (!selectedCampaignKey.value) {
    showError("É obrigatório vincular a postagem a uma campanha.");
    return;
  }

  if (!caption.value.trim()) {
    showError("A legenda da postagem é obrigatória.");
    return;
  }

  if (caption.value.trim().length > MAX_CAPTION_LENGTH) {
    showError(`A legenda excede o limite máximo permitido de ${MAX_CAPTION_LENGTH} caracteres pelo Instagram.`);
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = "";

  try {
    // 1. Criar Postagem no Banco
    statusMessage.value = "Criando postagem...";
    const postResponse = await apiFetch("/media/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ caption: caption.value.trim() }),
    });

    if (!postResponse.ok) await throwApiError(postResponse);
    const rawPostId = await postResponse.text();
    const postId = rawPostId.replace(/^"|"$/g, "");

    // 2. Upload e Vínculo Direto das Mídias (multipart/form-data)
    if (selectedFiles.value.length > 0) {
      for (let i = 0; i < selectedFiles.value.length; i++) {
        const file = selectedFiles.value[i];
        statusMessage.value = `Enviando imagem ${i + 1} de ${selectedFiles.value.length}...`;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("sequenceOrder", (i + 1).toString());

        const assetResponse = await apiFetch(`/media/posts/${postId}/assets`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
          body: formData,
        });

        if (!assetResponse.ok) await throwApiError(assetResponse);
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
    caption.value = "";
    selectedFiles.value = [];
    selectedCampaignKey.value = "";

    showSuccess("Sua postagem e imagens foram salvas com sucesso.", "Postagem Criada!");
    fetchPosts();
  } catch (error: any) {
    showError(error.message || "Falha na comunicação com o servidor.");
  } finally {
    isSubmitting.value = false;
    statusMessage.value = "";
  }
};

// ==========================================
// MÉTODOS: Edição de Postagem
// ==========================================
const openEditPostModal = (post: PostItem) => {
  editingPost.value = post;
  editCaption.value = post.caption || "";

  // Clona assets garantindo ordenação sequencial
  editableAssets.value = (post.assets || [])
    .slice()
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    .map((a) => ({
      mediaId: a.media?.id || (a as any).id,
      fileName: a.media?.fileName || "Imagem",
      sequenceOrder: a.sequenceOrder,
    }));

  assetsToRemove.value = [];
  editNewFiles.value = [];
  isEditPostDialogOpen.value = true;
};

const moveAssetOrder = (index: number, direction: "up" | "down") => {
  if (direction === "up" && index > 0) {
    const temp = editableAssets.value[index];
    editableAssets.value[index] = editableAssets.value[index - 1];
    editableAssets.value[index - 1] = temp;
  } else if (direction === "down" && index < editableAssets.value.length - 1) {
    const temp = editableAssets.value[index];
    editableAssets.value[index] = editableAssets.value[index + 1];
    editableAssets.value[index + 1] = temp;
  }

  // Renumera sequenceOrder localmente
  editableAssets.value.forEach((asset, idx) => {
    asset.sequenceOrder = idx + 1;
  });
};

const triggerReplaceAsset = (index: number, event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];

  const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    showError(`"${file.name}": Formato inválido. Apenas imagens JPEG (.jpg ou .jpeg) são permitidas.`);
    input.value = "";
    return;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    showError(`"${file.name}": O arquivo excede o limite máximo de 8 MB (${formatFileSize(file.size)}).`);
    input.value = "";
    return;
  }
  if (file.size === 0) {
    showError(`"${file.name}": O arquivo está vazio.`);
    input.value = "";
    return;
  }

  editableAssets.value[index].replacementFile = file;
  editableAssets.value[index].fileName = `${file.name} (Substituindo)`;
  input.value = "";
};

const removeAssetFromEdit = (index: number) => {
  const removed = editableAssets.value.splice(index, 1)[0];
  if (removed && removed.mediaId) {
    assetsToRemove.value.push(removed.mediaId);
  }

  // Reajusta sequenceOrder dos restantes
  editableAssets.value.forEach((asset, idx) => {
    asset.sequenceOrder = idx + 1;
  });
};

const handleEditNewFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const filesToAdd: File[] = [];
  const errors: string[] = [];

  for (const file of Array.from(input.files)) {
    const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      errors.push(`"${file.name}": Formato inválido. Apenas imagens JPEG (.jpg ou .jpeg) são permitidas.`);
      continue;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push(`"${file.name}": O arquivo excede o limite máximo de 8 MB (${formatFileSize(file.size)}).`);
      continue;
    }

    if (file.size === 0) {
      errors.push(`"${file.name}": O arquivo está vazio.`);
      continue;
    }

    filesToAdd.push(file);
  }

  if (errors.length > 0) {
    showError(errors.join("\n"));
  }

  if (filesToAdd.length > 0) {
    editNewFiles.value = [...editNewFiles.value, ...filesToAdd];
  }

  input.value = "";
};

const removeEditNewFile = (index: number) => {
  editNewFiles.value.splice(index, 1);
};

const handleSavePostEdit = async () => {
  if (!editingPost.value) return;
  if (!editCaption.value.trim()) {
    showError("A legenda da postagem é obrigatória.");
    return;
  }

  if (editCaption.value.trim().length > MAX_CAPTION_LENGTH) {
    showError(`A legenda excede o limite máximo permitido de ${MAX_CAPTION_LENGTH} caracteres pelo Instagram.`);
    return;
  }

  isSavingEdit.value = true;
  errorMessage.value = "";
  saveStatusMessage.value = "Salvando alterações da legenda...";

  try {
    const postId = editingPost.value.id;

    // 1. Atualizar Legenda via PUT /api/media/posts/{postId}
    if (editCaption.value.trim() !== editingPost.value.caption) {
      const putResponse = await apiFetch(`/media/posts/${postId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ caption: editCaption.value.trim() }),
      });

      if (!putResponse.ok) await throwApiError(putResponse);
    }

    // 2. Substituir mídias com arquivos selecionados
    for (const asset of editableAssets.value) {
      if (asset.replacementFile) {
        saveStatusMessage.value = `Substituindo "${asset.replacementFile.name}"...`;
        const formData = new FormData();
        formData.append("file", asset.replacementFile);

        const replaceResponse = await apiFetch(
          `/media/posts/${postId}/assets/${asset.mediaId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${getToken()}`,
            },
            body: formData,
          }
        );

        if (!replaceResponse.ok) await throwApiError(replaceResponse);
      }
    }

    // 3. Remover mídias marcadas para exclusão
    if (assetsToRemove.value.length > 0) {
      for (let i = 0; i < assetsToRemove.value.length; i++) {
        const mediaId = assetsToRemove.value[i];
        saveStatusMessage.value = `Removendo imagem ${i + 1} de ${assetsToRemove.value.length}...`;

        const deleteResponse = await apiFetch(
          `/media/posts/${postId}/assets/${mediaId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${getToken()}`,
            },
          }
        );

        if (!deleteResponse.ok && deleteResponse.status !== 404) {
          await throwApiError(deleteResponse);
        }
      }
    }

    // 4. Reordenar mídias restantes se a ordem foi modificada
    if (editableAssets.value.length > 1) {
      saveStatusMessage.value = "Atualizando ordem das imagens...";
      const mediaIds = editableAssets.value.map((a) => a.mediaId);
      const reorderResponse = await apiFetch(
        `/media/posts/${postId}/assets/order`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ mediaIds }),
        }
      );

      if (!reorderResponse.ok) await throwApiError(reorderResponse);
    }

    // 5. Enviar novas imagens adicionadas
    if (editNewFiles.value.length > 0) {
      const currentCount = editableAssets.value.length;
      for (let i = 0; i < editNewFiles.value.length; i++) {
        const file = editNewFiles.value[i];
        saveStatusMessage.value = `Enviando nova imagem ${i + 1} de ${editNewFiles.value.length}...`;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("sequenceOrder", (currentCount + i + 1).toString());

        const addResponse = await apiFetch(`/media/posts/${postId}/assets`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
          body: formData,
        });

        if (!addResponse.ok) await throwApiError(addResponse);
      }
    }

    isEditPostDialogOpen.value = false;
    showSuccess("Postagem e imagens atualizadas com sucesso!", "Postagem Atualizada");
    await fetchPosts();
  } catch (error: any) {
    showError(error.message || "Falha na comunicação com o servidor.");
  } finally {
    isSavingEdit.value = false;
    saveStatusMessage.value = "";
  }
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
            <div>
              <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
                Histórico de Postagens
                <span
                  v-if="!isFetching && totalCount > 0"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-soft-green/30 text-vibrant-green"
                >
                  {{ totalCount }}
                </span>
              </h2>
              <p class="text-xs text-gray-500 mt-0.5">
                Publicações cadastradas no sistema.
              </p>
            </div>
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
                  <TableHead class="text-center">Anexos</TableHead>
                  <TableHead class="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="posts.length === 0">
                  <TableCell colspan="5" class="text-center text-gray-500 py-8">
                    Nenhuma postagem encontrada.
                  </TableCell>
                </TableRow>
                <TableRow v-for="post in posts" :key="post.id">
                  <TableCell
                    class="font-medium text-gray-900 max-w-xs truncate"
                    :title="post.caption"
                  >
                    {{ post.caption || "Sem legenda" }}
                  </TableCell>
                  <TableCell>
                    <span
                      :class="[
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                        getStatusBadgeClasses(post.status),
                      ]"
                    >
                      {{ formatStatus(post.status) }}
                    </span>
                  </TableCell>
                  <TableCell class="text-gray-500 text-sm">
                    {{ formatDate(post.createdAt) }}
                  </TableCell>
                  <TableCell class="text-center">
                    <button
                      v-if="post.assets && post.assets.length > 0"
                      @click="viewAssets(post.assets)"
                      class="inline-flex items-center gap-2 group text-sm text-gray-700 hover:text-vibrant-green hover:bg-soft-green/20 px-2.5 py-1.5 rounded-lg transition-all border border-gray-100 hover:border-vibrant-green/30"
                      title="Visualizar fotos da publicação"
                    >
                      <!-- Miniatura da primeira imagem -->
                      <div class="relative w-7 h-7 rounded-md overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                        <img
                          :src="getMediaPublicUrl(post.assets[0].media?.id)"
                          :alt="post.assets[0].media?.fileName || 'Foto'"
                          class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                          loading="lazy"
                        />
                      </div>
                      <span class="inline-flex items-center text-xs font-semibold text-gray-600 group-hover:text-vibrant-green">
                        <Paperclip class="w-3.5 h-3.5 mr-1 text-gray-400 group-hover:text-vibrant-green" />
                        {{ post.assets.length }}
                      </span>
                    </button>
                    <span v-else class="text-gray-400 text-sm">-</span>
                  </TableCell>
                  <TableCell class="text-right">
                    <button
                      type="button"
                      @click="openEditPostModal(post)"
                      :disabled="post.status?.toLowerCase() === 'published'"
                      class="inline-flex items-center p-2 text-gray-600 hover:text-vibrant-green hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      :title="
                        post.status?.toLowerCase() === 'published'
                          ? 'Postagens já publicadas não podem ser editadas'
                          : 'Editar Postagem'
                      "
                    >
                      <Pencil class="w-4 h-4" />
                    </button>
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
              Vincular à Campanha *
            </label>
            <div class="relative">
              <Building2 class="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <select
                v-model="selectedCampaignKey"
                class="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent outline-none transition-all text-gray-900 bg-white"
                :disabled="isSubmitting || isFetchingCampaigns || availableCampaigns.length === 0"
                required
              >
                <option value="" disabled>Selecione uma campanha *</option>
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
              class="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between"
            >
              <span>É necessário ter pelo menos uma campanha cadastrada para criar postagens.</span>
              <router-link
                to="/campaigns"
                class="font-semibold text-amber-900 underline ml-2 hover:text-black flex-shrink-0"
              >
                Criar Campanha
              </router-link>
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700">
                Legenda da Postagem *
              </label>
              <span
                :class="[
                  'text-xs font-medium transition-colors',
                  caption.length > MAX_CAPTION_LENGTH
                    ? 'text-red-600 font-semibold'
                    : caption.length >= MAX_CAPTION_LENGTH * 0.9
                    ? 'text-amber-600'
                    : 'text-gray-500',
                ]"
              >
                {{ caption.length }} / {{ MAX_CAPTION_LENGTH }} caracteres
              </span>
            </div>
            <textarea
              v-model="caption"
              rows="4"
              :maxlength="MAX_CAPTION_LENGTH"
              placeholder="O que você quer compartilhar hoje?"
              :class="[
                'w-full p-4 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all resize-none text-gray-900',
                caption.length >= MAX_CAPTION_LENGTH
                  ? 'border-amber-300 focus:ring-amber-400'
                  : 'border-gray-200 focus:ring-vibrant-green',
              ]"
              :disabled="isSubmitting"
              required
            ></textarea>
            <p
              v-if="caption.length >= MAX_CAPTION_LENGTH"
              class="text-xs text-amber-600 mt-1"
            >
              Limite máximo de 2.200 caracteres da API do Instagram atingido.
            </p>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700">
                Imagens da Publicação (Opcional)
              </label>
              <span class="text-xs text-gray-500">
                JPEG (.jpg, .jpeg) de até 8 MB
              </span>
            </div>
            <div
              class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors"
            >
              <input
                type="file"
                id="modal-file-upload"
                multiple
                accept=".jpg,.jpeg,image/jpeg"
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
                  >Clique para selecionar imagens</span
                >
                <span class="text-xs text-gray-500 mt-1"
                  >Selecione uma ou mais fotos para o post</span
                >
              </label>
            </div>

            <div
              v-if="selectedFiles.length > 0"
              class="mt-4 space-y-2 max-h-56 overflow-y-auto pr-2"
            >
              <div
                v-for="(file, index) in selectedFiles"
                :key="index"
                class="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100/50 transition-colors"
              >
                <div class="flex items-center truncate space-x-3">
                  <span
                    class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-soft-green/40 text-vibrant-green text-xs font-bold flex-shrink-0"
                  >
                    {{ index + 1 }}º
                  </span>

                  <!-- Prévia da miniatura local -->
                  <div
                    class="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-200 border border-gray-200 flex-shrink-0 cursor-pointer group"
                    @click="openImagePreview(getFilePreviewUrl(file), file.name)"
                    title="Clique para ampliar"
                  >
                    <img
                      :src="getFilePreviewUrl(file)"
                      :alt="file.name"
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                      <Eye class="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div class="truncate">
                    <p class="text-sm text-gray-800 truncate font-medium">
                      {{ file.name }}
                    </p>
                    <span class="text-xs text-gray-400">
                      {{ formatFileSize(file.size) }}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  @click="removeFile(index)"
                  :disabled="isSubmitting"
                  class="text-gray-400 hover:text-red-500 transition-colors p-1"
                  title="Remover anexo"
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
                :disabled="isSubmitting || !caption.trim() || caption.length > MAX_CAPTION_LENGTH || !selectedCampaignKey || availableCampaigns.length === 0"
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

    <!-- Modal de Edição de Postagem -->
    <Dialog v-model:open="isEditPostDialogOpen">
      <DialogContent class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="text-gray-900 flex items-center gap-2">
            <Pencil class="w-5 h-5 text-vibrant-green" />
            Editar Postagem
          </DialogTitle>
          <DialogDescription>
            Altere a legenda e gerencie as fotos da publicação.
          </DialogDescription>
        </DialogHeader>

        <form @submit.prevent="handleSavePostEdit" class="space-y-5 mt-2">
          <!-- Legenda -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700">
                Legenda da Postagem *
              </label>
              <span
                :class="[
                  'text-xs font-medium transition-colors',
                  editCaption.length > MAX_CAPTION_LENGTH
                    ? 'text-red-600 font-semibold'
                    : editCaption.length >= MAX_CAPTION_LENGTH * 0.9
                    ? 'text-amber-600'
                    : 'text-gray-500',
                ]"
              >
                {{ editCaption.length }} / {{ MAX_CAPTION_LENGTH }} caracteres
              </span>
            </div>
            <textarea
              v-model="editCaption"
              rows="4"
              :maxlength="MAX_CAPTION_LENGTH"
              placeholder="Edite o conteúdo da postagem..."
              :class="[
                'w-full p-4 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all resize-none text-gray-900',
                editCaption.length >= MAX_CAPTION_LENGTH
                  ? 'border-amber-300 focus:ring-amber-400'
                  : 'border-gray-200 focus:ring-vibrant-green',
              ]"
              :disabled="isSavingEdit"
              required
            ></textarea>
            <p
              v-if="editCaption.length >= MAX_CAPTION_LENGTH"
              class="text-xs text-amber-600 mt-1"
            >
              Limite máximo de 2.200 caracteres da API do Instagram atingido.
            </p>
          </div>

          <!-- Mídias Atuais -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700">
                Imagens Atuais ({{ editableAssets.length }})
              </label>
              <span class="text-xs text-gray-500">
                Reordene, substitua ou remova imagens existentes
              </span>
            </div>

            <div
              v-if="editableAssets.length === 0"
              class="p-4 border border-dashed border-gray-300 rounded-lg text-center text-sm text-gray-500"
            >
              Nenhuma imagem associada a esta postagem.
            </div>

            <div
              v-else
              class="space-y-2.5 max-h-60 overflow-y-auto pr-1"
            >
              <div
                v-for="(asset, index) in editableAssets"
                :key="asset.mediaId"
                class="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100/60 transition-colors"
              >
                <div class="flex items-center truncate space-x-3 mr-2">
                  <span
                    class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-soft-green/40 text-vibrant-green text-xs font-bold flex-shrink-0"
                  >
                    {{ asset.sequenceOrder }}º
                  </span>

                  <!-- Prévia da miniatura (substituição ou servidor) -->
                  <div
                    class="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-200 border border-gray-200 flex-shrink-0 cursor-pointer group"
                    @click="openImagePreview(asset.replacementFile ? getFilePreviewUrl(asset.replacementFile) : getMediaPublicUrl(asset.mediaId), asset.fileName)"
                    title="Clique para ampliar a imagem"
                  >
                    <img
                      :src="asset.replacementFile ? getFilePreviewUrl(asset.replacementFile) : getMediaPublicUrl(asset.mediaId)"
                      :alt="asset.fileName"
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                      <Eye class="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div class="truncate">
                    <p
                      class="text-sm text-gray-800 truncate font-medium"
                      :class="{ 'text-emerald-700 font-semibold': asset.replacementFile }"
                      :title="asset.fileName"
                    >
                      {{ asset.fileName }}
                    </p>
                    <span v-if="asset.replacementFile" class="text-xs text-emerald-600 font-medium">
                      Substituindo foto original
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-1 flex-shrink-0">
                  <!-- Mover para cima -->
                  <button
                    type="button"
                    @click="moveAssetOrder(index, 'up')"
                    :disabled="index === 0 || isSavingEdit"
                    class="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Mover para cima"
                  >
                    <ArrowUp class="w-4 h-4" />
                  </button>

                  <!-- Mover para baixo -->
                  <button
                    type="button"
                    @click="moveAssetOrder(index, 'down')"
                    :disabled="index === editableAssets.length - 1 || isSavingEdit"
                    class="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Mover para baixo"
                  >
                    <ArrowDown class="w-4 h-4" />
                  </button>

                  <!-- Substituir imagem -->
                  <label
                    :for="`replace-file-${asset.mediaId}`"
                    class="p-1.5 text-gray-400 hover:text-vibrant-green cursor-pointer transition-colors"
                    title="Substituir arquivo desta imagem"
                  >
                    <RefreshCw class="w-4 h-4" />
                  </label>
                  <input
                    type="file"
                    :id="`replace-file-${asset.mediaId}`"
                    accept=".jpg,.jpeg,image/jpeg"
                    class="hidden"
                    :disabled="isSavingEdit"
                    @change="triggerReplaceAsset(index, $event)"
                  />

                  <!-- Remover imagem -->
                  <button
                    type="button"
                    @click="removeAssetFromEdit(index)"
                    :disabled="isSavingEdit"
                    class="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remover imagem"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Adicionar Novas Imagens -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700">
                Adicionar Novas Imagens
              </label>
              <span class="text-xs text-gray-500">
                JPEG (.jpg, .jpeg) de até 8 MB
              </span>
            </div>

            <div
              class="border-2 border-dashed border-gray-300 rounded-lg p-5 text-center hover:bg-gray-50 transition-colors"
            >
              <input
                type="file"
                id="edit-modal-file-upload"
                multiple
                accept=".jpg,.jpeg,image/jpeg"
                class="hidden"
                @change="handleEditNewFileChange"
                :disabled="isSavingEdit"
              />
              <label
                for="edit-modal-file-upload"
                class="cursor-pointer flex flex-col items-center"
              >
                <div class="p-2.5 bg-soft-green/30 rounded-full mb-2">
                  <ImagePlus class="w-5 h-5 text-vibrant-green" />
                </div>
                <span class="text-sm font-medium text-gray-900">
                  Clique para adicionar mais fotos
                </span>
                <span class="text-xs text-gray-500 mt-0.5">
                  Serão adicionadas ao final da publicação
                </span>
              </label>
            </div>

            <!-- Lista de novas imagens a adicionar -->
            <div
              v-if="editNewFiles.length > 0"
              class="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1"
            >
              <div
                v-for="(file, index) in editNewFiles"
                :key="index"
                class="flex items-center justify-between p-2.5 bg-emerald-50/60 border border-emerald-200/80 rounded-lg"
              >
                <div class="flex items-center truncate space-x-2.5">
                  <span
                    class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 text-xs font-bold flex-shrink-0"
                  >
                    +{{ editableAssets.length + index + 1 }}º
                  </span>

                  <!-- Prévia da miniatura local -->
                  <div
                    class="relative w-10 h-10 rounded-md overflow-hidden bg-gray-200 border border-gray-200 flex-shrink-0 cursor-pointer group"
                    @click="openImagePreview(getFilePreviewUrl(file), file.name)"
                    title="Clique para ampliar"
                  >
                    <img
                      :src="getFilePreviewUrl(file)"
                      :alt="file.name"
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                      <Eye class="w-3 h-3" />
                    </div>
                  </div>

                  <div class="truncate">
                    <p class="text-sm text-gray-800 truncate font-medium">
                      {{ file.name }}
                    </p>
                    <span class="text-xs text-gray-500">
                      ({{ formatFileSize(file.size) }})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  @click="removeEditNewFile(index)"
                  :disabled="isSavingEdit"
                  class="text-gray-400 hover:text-red-500 transition-colors p-1"
                  title="Remover nova foto"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- Rodapé do Modal -->
          <div
            class="flex items-center justify-between pt-4 border-t border-gray-100"
          >
            <span class="text-sm font-medium text-vibrant-green animate-pulse">
              {{ isSavingEdit ? saveStatusMessage : "" }}
            </span>
            <div class="flex items-center gap-3">
              <button
                type="button"
                @click="isEditPostDialogOpen = false"
                :disabled="isSavingEdit"
                class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="isSavingEdit || !editCaption.trim() || editCaption.length > MAX_CAPTION_LENGTH"
                class="flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2 px-6 rounded-lg transition-all disabled:opacity-50 text-sm"
              >
                <Loader2
                  v-if="isSavingEdit"
                  class="w-4 h-4 mr-2 animate-spin"
                />
                <Save v-else class="w-4 h-4 mr-2" />
                Salvar Alterações
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Modal de Visualização de Anexos -->
    <Dialog v-model:open="isAssetsDialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle class="text-gray-900 flex items-center">
            <ImageIcon class="w-5 h-5 mr-2 text-vibrant-green" />
            Anexos da Postagem ({{ selectedAssets.length }})
          </DialogTitle>
          <DialogDescription>
            Fotos vinculadas a esta publicação. Clique em qualquer foto para ampliar.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 mt-4 max-h-96 overflow-y-auto pr-2">
          <div
            v-for="asset in selectedAssets"
            :key="asset.media?.id || asset.id"
            class="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100/60 transition-colors"
          >
            <div class="flex items-center truncate mr-3 space-x-3">
              <span
                v-if="asset.sequenceOrder"
                class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-soft-green/40 text-vibrant-green text-xs font-bold flex-shrink-0"
              >
                {{ asset.sequenceOrder }}º
              </span>

              <!-- Miniatura com clique para ampliar -->
              <div
                class="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-200 border border-gray-200 flex-shrink-0 cursor-pointer group"
                @click="openImagePreview(getMediaPublicUrl(asset.media?.id), asset.media?.fileName)"
                title="Clique para ampliar"
              >
                <img
                  :src="getMediaPublicUrl(asset.media?.id)"
                  :alt="asset.media?.fileName || 'Imagem'"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
                <div class="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                  <Eye class="w-4 h-4" />
                </div>
              </div>

              <div class="truncate">
                <p
                  class="text-sm font-medium text-gray-900 truncate"
                  :title="asset.media?.fileName || 'Imagem'"
                >
                  {{ asset.media?.fileName || "Imagem" }}
                </p>
                <button
                  type="button"
                  @click="openImagePreview(getMediaPublicUrl(asset.media?.id), asset.media?.fileName)"
                  class="text-xs text-vibrant-green hover:underline flex items-center gap-1 mt-0.5"
                >
                  <Eye class="w-3 h-3" />
                  Ver ampliada
                </button>
              </div>
            </div>

            <button
              v-if="asset.media?.id"
              @click="downloadAsset(asset.media.id, asset.media.fileName)"
              :disabled="isDownloading[asset.media.id]"
              class="flex items-center justify-center text-gray-600 hover:text-vibrant-green transition-colors p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-50 flex-shrink-0"
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
            class="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            Fechar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Modal de Prévia Ampliada da Imagem (Lightbox) -->
    <Dialog v-model:open="isPreviewDialogOpen">
      <DialogContent class="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="text-gray-900 truncate">
            {{ previewImageTitle || "Visualização da Imagem" }}
          </DialogTitle>
          <DialogDescription>
            Visualização ampliada do anexo da publicação.
          </DialogDescription>
        </DialogHeader>

        <div class="mt-2 flex items-center justify-center bg-gray-900/5 rounded-xl p-2 overflow-hidden border border-gray-200">
          <img
            :src="previewImageUrl"
            :alt="previewImageTitle"
            class="max-h-[65vh] max-w-full rounded-lg object-contain shadow-sm"
          />
        </div>

        <DialogFooter class="mt-4">
          <button
            type="button"
            @click="isPreviewDialogOpen = false"
            class="w-full sm:w-auto px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-medium transition-colors text-sm"
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
          <DialogTitle class="text-vibrant-green">{{ successTitle }}</DialogTitle>
          <DialogDescription>
            {{ successMessage }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            @click="isSuccessDialogOpen = false"
            class="w-full bg-vibrant-green hover:bg-vibrant-green/90 text-white py-2 rounded-lg transition-colors font-medium"
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
          <DialogDescription class="whitespace-pre-line">{{ errorMessage }}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            @click="isErrorDialogOpen = false"
            class="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 rounded-lg transition-colors font-medium"
          >
            Fechar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
