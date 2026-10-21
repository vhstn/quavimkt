<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import {
  Users,
  Loader2,
  Plus,
  Mail,
  Check,
  X,
  Trash2,
  Shield,
  Crown,
  User,
  Clock,
  UserPlus,
} from "lucide-vue-next";
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

interface UserTeam {
  teamId: string;
  id?: string;
  teamName: string;
  role: string;
}

interface UserInvitation {
  id: string;
  teamId: string;
  teamName: string;
  role: string;
  invitedByName: string;
  expiresAt: string;
}

interface TeamMember {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  joinedAt: string;
}

interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  invitedByName: string;
  createdAt: string;
  expiresAt: string;
}

const teams = ref<UserTeam[]>([]);
const isFetchingTeams = ref(true);

const myInvitations = ref<UserInvitation[]>([]);
const isFetchingMyInvitations = ref(false);
const isRespondingInvitation = ref<Record<string, boolean>>({});

const isCreateTeamDialogOpen = ref(false);
const teamName = ref("");
const isCreatingTeam = ref(false);

const isMembersDialogOpen = ref(false);
const selectedTeam = ref<UserTeam | null>(null);
const activeTab = ref<"members" | "invitations">("members");

const teamMembers = ref<TeamMember[]>([]);
const isFetchingMembers = ref(false);

const teamInvitations = ref<TeamInvitation[]>([]);
const isFetchingTeamInvitations = ref(false);
const isCancelingInvitation = ref<Record<string, boolean>>({});

const isInviteDialogOpen = ref(false);
const inviteEmail = ref("");
const inviteRole = ref<"member" | "administrator">("member");
const isInviting = ref(false);

const isSuccessDialogOpen = ref(false);
const successTitle = ref("Sucesso!");
const successMessage = ref("");

const isErrorDialogOpen = ref(false);
const errorMessage = ref("");

const isManagerOfSelectedTeam = computed(() => {
  if (!selectedTeam.value) return false;
  const role = selectedTeam.value.role?.toLowerCase();
  return role === "owner" || role === "administrator";
});

const isManager = (role?: string) => {
  if (!role) return false;
  const normalized = role.toLowerCase();
  return normalized === "owner" || normalized === "administrator";
};

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

const parseErrorMessage = async (
  response: Response,
  defaultMessage: string,
) => {
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
      throw new Error(
        await parseErrorMessage(response, "Erro ao carregar times."),
      );
    }
    const data = await response.json();
    teams.value = data.teams || [];
  } catch (error: any) {
    showError(error.message || "Falha na comunicação com o servidor.");
  } finally {
    isFetchingTeams.value = false;
  }
};

const fetchMyInvitations = async () => {
  isFetchingMyInvitations.value = true;
  try {
    const response = await apiFetch("/identity/users/me/invitations");
    if (!response.ok) {
      throw new Error(
        await parseErrorMessage(response, "Erro ao carregar convites."),
      );
    }
    const data = await response.json();
    myInvitations.value = Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error("Erro ao carregar convites do usuário:", error);
  } finally {
    isFetchingMyInvitations.value = false;
  }
};

onMounted(() => {
  fetchTeams();
  fetchMyInvitations();
});

const handleAcceptInvitation = async (invitation: UserInvitation) => {
  isRespondingInvitation.value[invitation.id] = true;
  try {
    const response = await apiFetch(
      `/identity/users/me/invitations/${invitation.id}/accept`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new Error(
        await parseErrorMessage(
          response,
          "Não foi possível aceitar o convite.",
        ),
      );
    }

    showSuccess(
      `Você agora faz parte do time "${invitation.teamName}"!`,
      "Convite Aceito!",
    );
    await Promise.all([fetchTeams(), fetchMyInvitations()]);
  } catch (error: any) {
    showError(error.message || "Erro ao aceitar convite.");
  } finally {
    isRespondingInvitation.value[invitation.id] = false;
  }
};

const handleDeclineInvitation = async (invitation: UserInvitation) => {
  isRespondingInvitation.value[invitation.id] = true;
  try {
    const response = await apiFetch(
      `/identity/users/me/invitations/${invitation.id}/decline`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new Error(
        await parseErrorMessage(
          response,
          "Não foi possível recusar o convite.",
        ),
      );
    }

    showSuccess(
      `Convite para o time "${invitation.teamName}" recusado.`,
      "Convite Recusado",
    );
    await fetchMyInvitations();
  } catch (error: any) {
    showError(error.message || "Erro ao recusar convite.");
  } finally {
    isRespondingInvitation.value[invitation.id] = false;
  }
};

const handleCreateTeam = async () => {
  if (!teamName.value.trim()) return;

  isCreatingTeam.value = true;
  try {
    const response = await apiFetch("/workflow/teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teamName: teamName.value.trim(),
      }),
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, "Erro ao criar time."));
    }

    isCreateTeamDialogOpen.value = false;
    teamName.value = "";
    showSuccess("O time foi criado com sucesso!");
    await fetchTeams();
  } catch (error: any) {
    showError(error.message || "Falha na comunicação com o servidor.");
  } finally {
    isCreatingTeam.value = false;
  }
};

const getTeamId = (team: UserTeam): string => {
  return team.teamId || team.id || "";
};

const openMembersModal = async (team: UserTeam) => {
  selectedTeam.value = team;
  activeTab.value = "members";
  isMembersDialogOpen.value = true;
  await loadTeamMembers(getTeamId(team));

  if (isManager(team.role)) {
    await loadTeamInvitations(getTeamId(team));
  }
};

const loadTeamMembers = async (teamId: string) => {
  if (!teamId) return;
  isFetchingMembers.value = true;
  try {
    const response = await apiFetch(`/workflow/teams/${teamId}/members`);
    if (!response.ok) {
      throw new Error(
        await parseErrorMessage(response, "Erro ao buscar membros do time."),
      );
    }
    const data = await response.json();
    teamMembers.value = data.members || [];
  } catch (error: any) {
    showError(error.message || "Falha ao carregar membros.");
  } finally {
    isFetchingMembers.value = false;
  }
};

const loadTeamInvitations = async (teamId: string) => {
  if (!teamId) return;
  isFetchingTeamInvitations.value = true;
  try {
    const response = await apiFetch(`/workflow/teams/${teamId}/invitations`);
    if (!response.ok) {
      throw new Error(
        await parseErrorMessage(response, "Erro ao buscar convites do time."),
      );
    }
    const data = await response.json();
    teamInvitations.value = Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error("Erro ao carregar convites do time:", error);
  } finally {
    isFetchingTeamInvitations.value = false;
  }
};

const openInviteModal = () => {
  inviteEmail.value = "";
  inviteRole.value = "member";
  isInviteDialogOpen.value = true;
};

const handleSendInvitation = async () => {
  if (!selectedTeam.value || !inviteEmail.value.trim()) return;

  const teamId = getTeamId(selectedTeam.value);
  isInviting.value = true;

  try {
    const response = await apiFetch(`/workflow/teams/${teamId}/invitations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: inviteEmail.value.trim(),
        role: inviteRole.value,
      }),
    });

    if (!response.ok) {
      throw new Error(
        await parseErrorMessage(response, "Não foi possível enviar o convite."),
      );
    }

    isInviteDialogOpen.value = false;
    inviteEmail.value = "";
    showSuccess(
      "Convite enviado com sucesso! O usuário receberá a notificação.",
      "Convite Registrado",
    );
    await loadTeamInvitations(teamId);
  } catch (error: any) {
    showError(error.message || "Erro ao convidar usuário.");
  } finally {
    isInviting.value = false;
  }
};

const handleCancelInvitation = async (invitationId: string) => {
  if (!selectedTeam.value) return;
  const teamId = getTeamId(selectedTeam.value);

  isCancelingInvitation.value[invitationId] = true;
  try {
    const response = await apiFetch(
      `/workflow/teams/${teamId}/invitations/${invitationId}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      throw new Error(
        await parseErrorMessage(response, "Erro ao cancelar o convite."),
      );
    }

    showSuccess("O convite foi cancelado.", "Convite Cancelado");
    await loadTeamInvitations(teamId);
  } catch (error: any) {
    showError(error.message || "Erro ao cancelar convite.");
  } finally {
    isCancelingInvitation.value[invitationId] = false;
  }
};
</script>

<template>
  <div class="flex min-h-screen bg-gray-50">
    <AppSidebar />

    <div class="flex-1 overflow-auto">
      <div class="p-8 max-w-6xl">
        <div class="mb-8 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 mb-2">
              Gestão de Times
            </h1>
            <p class="text-gray-600">
              Cadastre novas equipes, gerencie membros e responda a convites.
            </p>
          </div>
        </div>

        <div
          v-if="myInvitations.length > 0"
          class="mb-8 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 border border-emerald-200 rounded-xl p-6 shadow-sm"
        >
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-3">
              <div class="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                <Mail class="w-5 h-5" />
              </div>
              <div>
                <h2
                  class="text-base font-semibold text-gray-900 flex items-center gap-2"
                >
                  Convites Pendentes
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
                  >
                    {{ myInvitations.length }}
                  </span>
                </h2>
                <p class="text-xs text-gray-600">
                  Você foi convidado para colaborar nestas equipes. Aceite para
                  começar a participar.
                </p>
              </div>
            </div>
          </div>

          <div
            class="bg-white rounded-lg border border-emerald-100 overflow-hidden shadow-sm"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Convidado por</TableHead>
                  <TableHead>Papel Oferecido</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead class="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="invitation in myInvitations"
                  :key="invitation.id"
                >
                  <TableCell class="font-medium text-gray-900">
                    {{ invitation.teamName }}
                  </TableCell>
                  <TableCell class="text-gray-600 text-sm">
                    {{ invitation.invitedByName || "-" }}
                  </TableCell>
                  <TableCell>
                    <span
                      :class="[
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                        getRoleBadgeClasses(invitation.role),
                      ]"
                    >
                      <Shield
                        v-if="invitation.role === 'administrator'"
                        class="w-3 h-3 mr-1"
                      />
                      <User v-else class="w-3 h-3 mr-1" />
                      {{ formatRole(invitation.role) }}
                    </span>
                  </TableCell>
                  <TableCell class="text-xs text-gray-500">
                    <span class="inline-flex items-center gap-1">
                      <Clock class="w-3.5 h-3.5 text-gray-400" />
                      {{ formatDate(invitation.expiresAt) }}
                    </span>
                  </TableCell>
                  <TableCell class="text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        @click="handleAcceptInvitation(invitation)"
                        :disabled="isRespondingInvitation[invitation.id]"
                        class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-vibrant-green hover:bg-vibrant-green/90 text-white transition-colors shadow-sm disabled:opacity-50"
                      >
                        <Loader2
                          v-if="isRespondingInvitation[invitation.id]"
                          class="w-3.5 h-3.5 mr-1 animate-spin"
                        />
                        <Check v-else class="w-3.5 h-3.5 mr-1" />
                        Aceitar
                      </button>
                      <button
                        type="button"
                        @click="handleDeclineInvitation(invitation)"
                        :disabled="isRespondingInvitation[invitation.id]"
                        class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
                      >
                        <X class="w-3.5 h-3.5 mr-1 text-red-500" />
                        Recusar
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <div
          class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
        >
          <div
            class="p-6 border-b border-gray-200 flex justify-between items-center"
          >
            <div>
              <h2 class="text-lg font-semibold text-gray-900">
                Times Cadastrados
              </h2>
              <p class="text-xs text-gray-500 mt-0.5">
                Equipes das quais você participa e gerencia.
              </p>
            </div>
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
            <div v-if="isFetchingTeams" class="flex justify-center p-8">
              <Loader2 class="w-6 h-6 text-vibrant-green animate-spin" />
            </div>

            <Table v-else>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Time</TableHead>
                  <TableHead>Seu Papel</TableHead>
                  <TableHead class="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="teams.length === 0">
                  <TableCell colspan="3" class="text-center text-gray-500 py-8">
                    Nenhum time encontrado. Crie um novo time para começar!
                  </TableCell>
                </TableRow>
                <TableRow v-for="team in teams" :key="getTeamId(team)">
                  <TableCell class="font-medium text-gray-900">
                    <div class="flex items-center space-x-2">
                      <div
                        class="w-8 h-8 rounded-lg bg-soft-green/30 text-vibrant-green flex items-center justify-center font-bold text-xs uppercase"
                      >
                        {{ team.teamName.slice(0, 2) }}
                      </div>
                      <span>{{ team.teamName }}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      :class="[
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                        getRoleBadgeClasses(team.role),
                      ]"
                    >
                      <Crown
                        v-if="team.role === 'owner'"
                        class="w-3 h-3 mr-1"
                      />
                      <Shield
                        v-else-if="team.role === 'administrator'"
                        class="w-3 h-3 mr-1"
                      />
                      <User v-else class="w-3 h-3 mr-1" />
                      {{ formatRole(team.role) }}
                    </span>
                  </TableCell>
                  <TableCell class="text-right">
                    <button
                      type="button"
                      @click="openMembersModal(team)"
                      class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
                    >
                      <Users class="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                      Membros & Convites
                    </button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog v-model:open="isMembersDialogOpen">
          <DialogContent class="sm:max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <div class="flex items-center justify-between">
                <div>
                  <DialogTitle
                    class="text-gray-900 text-lg flex items-center gap-2"
                  >
                    <Users class="w-5 h-5 text-vibrant-green" />
                    {{ selectedTeam?.teamName }}
                  </DialogTitle>
                  <DialogDescription class="mt-1">
                    Visualize os membros participantes e gerencie os convites da
                    equipe.
                  </DialogDescription>
                </div>
                <span
                  v-if="selectedTeam"
                  :class="[
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                    getRoleBadgeClasses(selectedTeam.role),
                  ]"
                >
                  Seu papel: {{ formatRole(selectedTeam.role) }}
                </span>
              </div>
            </DialogHeader>

            <div class="flex border-b border-gray-200 mt-2">
              <button
                type="button"
                @click="activeTab = 'members'"
                :class="[
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'members'
                    ? 'border-vibrant-green text-vibrant-green'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                ]"
              >
                Membros Ativos ({{ teamMembers.length }})
              </button>
              <button
                v-if="isManagerOfSelectedTeam"
                type="button"
                @click="activeTab = 'invitations'"
                :class="[
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5',
                  activeTab === 'invitations'
                    ? 'border-vibrant-green text-vibrant-green'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                ]"
              >
                Convites Pendentes
                <span
                  v-if="teamInvitations.length > 0"
                  class="bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded-full text-xs"
                >
                  {{ teamInvitations.length }}
                </span>
              </button>
            </div>

            <div
              v-if="activeTab === 'members'"
              class="flex-1 overflow-y-auto py-4"
            >
              <div v-if="isFetchingMembers" class="flex justify-center py-8">
                <Loader2 class="w-6 h-6 text-vibrant-green animate-spin" />
              </div>

              <div
                v-else-if="teamMembers.length === 0"
                class="text-center py-8 text-gray-500 text-sm"
              >
                Nenhum membro listado para esta equipe.
              </div>

              <Table v-else>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membro</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Entrou em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="member in teamMembers" :key="member.userId">
                    <TableCell class="font-medium text-gray-900">
                      {{ member.userName || "-" }}
                    </TableCell>
                    <TableCell class="text-gray-600 text-sm">
                      {{ member.userEmail }}
                    </TableCell>
                    <TableCell>
                      <span
                        :class="[
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                          getRoleBadgeClasses(member.role),
                        ]"
                      >
                        <Crown
                          v-if="member.role === 'owner'"
                          class="w-3 h-3 mr-1"
                        />
                        <Shield
                          v-else-if="member.role === 'administrator'"
                          class="w-3 h-3 mr-1"
                        />
                        <User v-else class="w-3 h-3 mr-1" />
                        {{ formatRole(member.role) }}
                      </span>
                    </TableCell>
                    <TableCell class="text-xs text-gray-500">
                      {{ formatDate(member.joinedAt) }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div
              v-if="activeTab === 'invitations'"
              class="flex-1 overflow-y-auto py-4 space-y-4"
            >
              <div
                class="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100"
              >
                <p class="text-xs text-gray-600">
                  Convites pendentes enviados para novos colaboradores. Válidos
                  por 7 dias.
                </p>
                <button
                  type="button"
                  @click="openInviteModal"
                  class="flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-1.5 px-3 rounded-lg text-xs transition-colors shadow-sm"
                >
                  <UserPlus class="w-3.5 h-3.5 mr-1.5" />
                  Convidar Membro
                </button>
              </div>

              <div
                v-if="isFetchingTeamInvitations"
                class="flex justify-center py-8"
              >
                <Loader2 class="w-6 h-6 text-vibrant-green animate-spin" />
              </div>

              <div
                v-else-if="teamInvitations.length === 0"
                class="text-center py-8 text-gray-500 text-sm"
              >
                Não há convites pendentes para este time.
              </div>

              <Table v-else>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Convidado por</TableHead>
                    <TableHead>Expira em</TableHead>
                    <TableHead class="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="inv in teamInvitations" :key="inv.id">
                    <TableCell class="font-medium text-gray-900 text-sm">
                      {{ inv.email }}
                    </TableCell>
                    <TableCell>
                      <span
                        :class="[
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                          getRoleBadgeClasses(inv.role),
                        ]"
                      >
                        {{ formatRole(inv.role) }}
                      </span>
                    </TableCell>
                    <TableCell class="text-xs text-gray-600">
                      {{ inv.invitedByName || "-" }}
                    </TableCell>
                    <TableCell class="text-xs text-gray-500">
                      {{ formatDate(inv.expiresAt) }}
                    </TableCell>
                    <TableCell class="text-right">
                      <button
                        type="button"
                        @click="handleCancelInvitation(inv.id)"
                        :disabled="isCancelingInvitation[inv.id]"
                        class="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors disabled:opacity-50"
                        title="Cancelar convite"
                      >
                        <Loader2
                          v-if="isCancelingInvitation[inv.id]"
                          class="w-4 h-4 animate-spin text-red-500"
                        />
                        <Trash2 v-else class="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <DialogFooter class="border-t border-gray-100 pt-3">
              <button
                type="button"
                @click="isMembersDialogOpen = false"
                class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg"
              >
                Fechar
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog v-model:open="isInviteDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle class="text-gray-900 flex items-center gap-2">
                <UserPlus class="w-5 h-5 text-vibrant-green" />
                Convidar Membro
              </DialogTitle>
              <DialogDescription>
                Envie um convite para o time
                <strong class="text-gray-900">{{
                  selectedTeam?.teamName
                }}</strong
                >.
              </DialogDescription>
            </DialogHeader>

            <form @submit.prevent="handleSendInvitation" class="space-y-4 mt-2">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  E-mail do Convidado
                </label>
                <div class="relative">
                  <Mail class="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    v-model="inviteEmail"
                    type="email"
                    placeholder="colega@empresa.com"
                    class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent outline-none transition-all text-gray-900 text-sm"
                    required
                    :disabled="isInviting"
                  />
                </div>
                <p class="text-xs text-gray-500 mt-1">
                  O usuário precisará aceitar o convite utilizando esta conta de
                  e-mail.
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Papel Oferecido
                </label>
                <select
                  v-model="inviteRole"
                  class="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent outline-none transition-all text-gray-900 text-sm bg-white"
                  :disabled="isInviting"
                >
                  <option value="member">
                    Membro (pode criar postagens e visualizar campanhas)
                  </option>
                  <option value="administrator">
                    Administrador (pode convidar e gerenciar membros)
                  </option>
                </select>
              </div>

              <DialogFooter class="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  @click="isInviteDialogOpen = false"
                  :disabled="isInviting"
                  class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="isInviting || !inviteEmail"
                  class="flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2 px-6 rounded-lg transition-all disabled:opacity-50 text-sm"
                >
                  <Loader2
                    v-if="isInviting"
                    class="w-4 h-4 mr-2 animate-spin"
                  />
                  <UserPlus v-else class="w-4 h-4 mr-2" />
                  Enviar Convite
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

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
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Time
                </label>
                <div class="relative">
                  <Users class="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    v-model="teamName"
                    type="text"
                    placeholder="Ex: Marketing Digital, Vendas Internas..."
                    class="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent outline-none transition-all text-gray-900"
                    required
                    :disabled="isCreatingTeam"
                  />
                </div>
              </div>

              <DialogFooter class="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  @click="isCreateTeamDialogOpen = false"
                  :disabled="isCreatingTeam"
                  class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="isCreatingTeam || !teamName"
                  class="flex items-center bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2 px-6 rounded-lg transition-all disabled:opacity-50 text-sm"
                >
                  <Loader2
                    v-if="isCreatingTeam"
                    class="w-4 h-4 mr-2 animate-spin"
                  />
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
              <DialogTitle class="text-vibrant-green">{{
                successTitle
              }}</DialogTitle>
              <DialogDescription>
                {{ successMessage }}
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

        <Dialog v-model:open="isErrorDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle class="text-red-600">Erro na Operação</DialogTitle>
              <DialogDescription>{{ errorMessage }}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                @click="isErrorDialogOpen = false"
                class="w-full bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
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
