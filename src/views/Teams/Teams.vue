<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Users, Loader2, Plus } from "lucide-vue-next";
import AppSidebar from "@/components/layout/AppSidebar.vue";
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

const teamName = ref("");
const isLoading = ref(false);
const isCreateTeamDialogOpen = ref(false);
const isSuccessDialogOpen = ref(false);
const isErrorDialogOpen = ref(false);
const errorMessage = ref("");

const teams = ref<any[]>([]);
const isFetching = ref(true);

const fetchTeams = async () => {
  isFetching.value = true;
  try {
    const response = await apiFetch("/identity/users/me/teams", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("@MktApp:token")}`,
      },
    });

    if (!response.ok) throw new Error("Erro ao carregar times");

    const data = await response.json();
    teams.value = data.teams;
  } catch (error: any) {
    errorMessage.value = error.message;
    isErrorDialogOpen.value = true;
  } finally {
    isFetching.value = false;
  }
};

onMounted(() => {
  fetchTeams();
});

const handleCreateTeam = async () => {
  if (!teamName.value) return;

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const response = await apiFetch("/workflow/teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("@MktApp:token")}`,
      },
      body: JSON.stringify({
        teamName: teamName.value,
      }),
    });

    const rawText = await response.text();

    if (!response.ok) {
      let apiMessage = "Erro ao criar time.";
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
    }

    isCreateTeamDialogOpen.value = false;
    isSuccessDialogOpen.value = true;
    teamName.value = "";
    fetchTeams();
  } catch (error: any) {
    errorMessage.value =
      error.message || "Falha na comunicação com o servidor.";
    isErrorDialogOpen.value = true;
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="flex min-h-screen bg-gray-50">
    <AppSidebar />

    <div class="flex-1 overflow-auto">
      <div class="p-8">
        <div class="mb-8 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 mb-2">
              Gestão de Times
            </h1>
            <p class="text-gray-600">
              Cadastre novas equipes para organizar o seu fluxo de trabalho.
            </p>
          </div>
        </div>

        <div
          class="max-w-4xl bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
        >
          <div
            class="p-6 border-b border-gray-200 flex justify-between items-center"
          >
            <h2 class="text-lg font-semibold text-gray-900">
              Times Cadastrados
            </h2>
            <button
              type="button"
              @click="isCreateTeamDialogOpen = true"
              class="flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2.5 px-4 rounded-lg transition-all shadow-sm text-sm"
            >
              <Plus class="w-4 h-4 mr-2" />
              Adicionar Time
            </button>
          </div>

          <div class="p-0">
            <div v-if="isFetching" class="flex justify-center p-8">
              <Loader2 class="w-6 h-6 text-vibrant-green animate-spin" />
            </div>

            <Table v-else>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="teams.length === 0">
                  <TableCell class="text-center text-gray-500 py-6">
                    Nenhum time encontrado.
                  </TableCell>
                </TableRow>
                <TableRow v-for="team in teams" :key="team.id">
                  <TableCell class="font-medium text-gray-900">
                    {{ team.teamName }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <!-- Modal de Cadastro de Time -->
        <Dialog v-model:open="isCreateTeamDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle class="text-gray-900">Cadastrar Time</DialogTitle>
              <DialogDescription>
                Informe o nome da equipe para organizar o seu fluxo de trabalho.
              </DialogDescription>
            </DialogHeader>

            <form @submit.prevent="handleCreateTeam" class="space-y-4 mt-2">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"
                  >Nome do Time</label
                >
                <div class="relative">
                  <Users class="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    v-model="teamName"
                    type="text"
                    placeholder="Ex: Marketing Digital, Vendas Internas..."
                    class="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent outline-none transition-all text-gray-900"
                    required
                    :disabled="isLoading"
                  />
                </div>
              </div>

              <DialogFooter class="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  @click="isCreateTeamDialogOpen = false"
                  :disabled="isLoading"
                  class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="isLoading || !teamName"
                  class="flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2 px-6 rounded-lg transition-all disabled:opacity-50 text-sm"
                >
                  <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
                  <Plus v-else class="w-4 h-4 mr-2" />
                  Criar Time
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog v-model:open="isSuccessDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle class="text-vibrant-green">Sucesso!</DialogTitle>
              <DialogDescription>
                O time foi criado com sucesso.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                @click="isSuccessDialogOpen = false"
                class="w-full bg-vibrant-green text-white py-2 rounded-lg"
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
                class="w-full bg-gray-100 py-2 rounded-lg"
              >
                Fechar
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  </div>
</template>
