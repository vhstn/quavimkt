<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Boxes, Loader2, Lock, AlertCircle, Eye, EyeOff } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";

const route = useRoute();
const router = useRouter();

const password = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const isLoading = ref(false);

const isInvalidLink = ref(false);
const errorMessage = ref("");
const isErrorDialogOpen = ref(false);
const isSuccessDialogOpen = ref(false);

onMounted(() => {
  if (!route.query.token || !route.query.email) {
    isInvalidLink.value = true;
  }
});

const handleResetPassword = async () => {
  if (password.value !== confirmPassword.value) {
    errorMessage.value = "As senhas não coincidem.";
    isErrorDialogOpen.value = true;
    return;
  }

  if (password.value.length < 6) {
    errorMessage.value = "A senha deve ter pelo menos 6 caracteres.";
    isErrorDialogOpen.value = true;
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const rawToken = (route.query.token as string) || "";

    const sanitizedToken = rawToken.replace(/ /g, "+").replace(/[\r\n]/g, "");

    const response = await apiFetch("/identity/users/reset-password/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: route.query.email,
        token: sanitizedToken,
        newPassword: password.value,
      }),
    });

    const rawText = await response.text();

    if (!response.ok) {
      let apiMessage = "Erro ao redefinir a senha. O token pode ter expirado.";
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

    isSuccessDialogOpen.value = true;
  } catch (error: any) {
    errorMessage.value =
      error.message || "Falha na comunicação com o servidor.";
    isErrorDialogOpen.value = true;
  } finally {
    isLoading.value = false;
  }
};

const goToLogin = () => {
  isSuccessDialogOpen.value = false;
  router.push("/login");
};
</script>

<template>
  <div
    class="min-h-screen bg-gradient-to-br from-soft-green via-green-50 to-vibrant-green/20 flex items-center justify-center p-4"
  >
    <div class="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
      <div class="flex justify-center mb-6">
        <Boxes class="w-12 h-12 text-vibrant-green" />
      </div>

      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold text-gray-900 mb-2">Nova Senha</h1>
        <p class="text-gray-600 text-sm">
          Crie uma nova senha para acessar sua conta
        </p>
      </div>

      <div v-if="isInvalidLink" class="text-center space-y-4">
        <div class="flex justify-center">
          <AlertCircle class="w-12 h-12 text-red-500" />
        </div>
        <p class="text-gray-800 font-medium">Link de recuperação inválido</p>
        <p class="text-sm text-gray-500">
          O link que você acessou está incompleto ou quebrado. Por favor,
          solicite uma nova redefinição de senha.
        </p>
        <button
          @click="router.push('/login')"
          class="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 rounded-lg transition-colors"
        >
          Voltar para o Login
        </button>
      </div>

      <form v-else class="space-y-5" @submit.prevent="handleResetPassword">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Nova Senha</label
          >
          <div class="relative">
            <Lock class="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              :type="showPassword ? 'text' : 'password'"
              v-model="password"
              placeholder="••••••••"
              class="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent outline-none transition-all"
              required
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
              :aria-label="showPassword ? 'Ocultar senha' : 'Exibir senha'"
              tabindex="-1"
            >
              <EyeOff v-if="showPassword" class="w-5 h-5" />
              <Eye v-else class="w-5 h-5" />
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Confirme a Nova Senha</label
          >
          <div class="relative">
            <Lock class="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              :type="showConfirmPassword ? 'text' : 'password'"
              v-model="confirmPassword"
              placeholder="••••••••"
              class="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent outline-none transition-all"
              required
            />
            <button
              type="button"
              @click="showConfirmPassword = !showConfirmPassword"
              class="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
              :aria-label="showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'"
              tabindex="-1"
            >
              <EyeOff v-if="showConfirmPassword" class="w-5 h-5" />
              <Eye v-else class="w-5 h-5" />
            </button>
          </div>
        </div>

        <button
          type="submit"
          :disabled="isLoading || !password || !confirmPassword"
          class="w-full bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-3 rounded-lg transition-all flex justify-center items-center disabled:opacity-50"
        >
          <Loader2 v-if="isLoading" class="w-5 h-5 mr-2 animate-spin" />
          {{ isLoading ? "Salvando..." : "Redefinir Senha" }}
        </button>
      </form>

      <Dialog v-model:open="isSuccessDialogOpen">
        <DialogContent class="sm:max-w-md" :closable="false">
          <DialogHeader>
            <DialogTitle class="text-vibrant-green"
              >Senha Alterada!</DialogTitle
            >
            <DialogDescription>
              Sua senha foi redefinida com sucesso. Você já pode acessar o
              sistema.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              @click="goToLogin"
              class="w-full bg-vibrant-green text-white py-2 rounded-lg font-medium"
            >
              Ir para o Login
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog v-model:open="isErrorDialogOpen">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle class="text-red-600">Erro na Redefinição</DialogTitle>
            <DialogDescription>{{ errorMessage }}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              @click="isErrorDialogOpen = false"
              class="w-full bg-gray-100 hover:bg-gray-200 py-2 rounded-lg font-medium text-gray-900"
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </div>
</template>
