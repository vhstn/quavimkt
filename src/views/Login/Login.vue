<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Boxes, Loader2, Eye, EyeOff } from "lucide-vue-next";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const router = useRouter();
const route = useRoute();
const email = ref("");
const password = ref("");
const showPassword = ref(false);
const isLoading = ref(false);
const errorMessage = ref("");
const isErrorDialogOpen = ref(false);
const isExpiredSession = ref(false);

const isResettingPassword = ref(false);
const successMessage = ref("");
const isSuccessDialogOpen = ref(false);

onMounted(() => {
  if (route.query.expired === "true") {
    isExpiredSession.value = true;
    errorMessage.value = "Sua sessão expirou. Por favor, faça login novamente.";
    isErrorDialogOpen.value = true;
    router.replace("/login");
  }
});

const handleLogin = async () => {
  if (!email.value || !password.value) return;

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const response = await apiFetch("/identity/tokens/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.value,
        password: password.value,
      }),
    });

    if (!response.ok) {
      const apiMessage = await response.text();
      throw new Error(JSON.parse(apiMessage).detail);
    }

    const data = await response.json();

    localStorage.setItem("@MktApp:token", data.token);

    router.push("/dashboard");
  } catch (error: any) {
    errorMessage.value = error.message || "Falha ao conectar com o servidor.";
    isErrorDialogOpen.value = true;
  } finally {
    isLoading.value = false;
  }
};

const handleResetPassword = async () => {
  if (!email.value) {
    errorMessage.value = "Preencha o campo de e-mail para redefinir a senha.";
    isErrorDialogOpen.value = true;
    return;
  }

  isResettingPassword.value = true;
  errorMessage.value = "";

  try {
    const response = await apiFetch("/identity/tokens/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email.value }),
    });

    if (!response.ok) {
      const apiMessage = await response.text();
      throw new Error(JSON.parse(apiMessage).detail);
    }

    successMessage.value =
      "Você receberá as instruções para redefinir sua senha por e-mail.";
    isSuccessDialogOpen.value = true;
  } catch (error: any) {
    errorMessage.value = error.message || "Falha ao conectar com o servidor.";
    isErrorDialogOpen.value = true;
  } finally {
    isResettingPassword.value = false;
  }
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
        <h1 class="text-2xl font-semibold text-gray-900 mb-2">
          Bem-vindo de volta
        </h1>
        <p class="text-solid-black/70 text-sm">
          Entre na sua conta para continuar
        </p>
      </div>

      <form class="space-y-6" @submit.prevent="handleLogin">
        <div>
          <label
            for="email"
            class="block text-sm font-medium text-gray-700 mb-2"
            >E-mail</label
          >
          <input
            id="email"
            type="email"
            v-model="email"
            placeholder="seu@email.com"
            class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent transition-all duration-200 text-solid-black placeholder-gray-400"
          />
        </div>

        <div>
          <label
            for="password"
            class="block text-sm font-medium text-gray-700 mb-2"
            >Senha</label
          >
          <div class="relative mb-2">
            <input
              id="password"
              :type="showPassword ? 'text' : 'password'"
              v-model="password"
              placeholder="••••••••"
              class="w-full px-4 pr-10 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent transition-all duration-200 text-solid-black placeholder-gray-400"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
              :aria-label="showPassword ? 'Ocultar senha' : 'Exibir senha'"
              tabindex="-1"
            >
              <EyeOff v-if="showPassword" class="w-5 h-5" />
              <Eye v-else class="w-5 h-5" />
            </button>
          </div>
          <button
            type="button"
            @click="handleResetPassword"
            :disabled="isResettingPassword"
            class="text-xs text-vibrant-green hover:text-vibrant-green/80 font-medium transition-colors disabled:opacity-50"
          >
            {{ isResettingPassword ? "Enviando..." : "Esqueceu a senha?" }}
          </button>
        </div>

        <button
          type="submit"
          :disabled="isLoading"
          class="w-full bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-vibrant-green focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
        >
          <span v-if="isLoading" class="flex items-center">
            <Loader2 class="w-4 h-4 mr-2 animate-spin" /> Conectando...
          </span>
          <span v-else>Entrar</span>
        </button>
      </form>

      <div class="text-center mt-6">
        <p class="text-sm text-gray-600">
          Não tem uma conta?
          <router-link
            to="/register"
            class="text-vibrant-green hover:text-vibrant-green/80 font-medium transition-colors duration-200"
          >
            Cadastre-se
          </router-link>
        </p>
      </div>

      <Dialog v-model:open="isErrorDialogOpen">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle class="text-red-600">Erro</DialogTitle>
            <DialogDescription>
              {{ errorMessage }}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              @click="isErrorDialogOpen = false"
              class="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors duration-200 mt-2"
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog v-model:open="isSuccessDialogOpen">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle class="text-vibrant-green"
              >Recuperação de Senha</DialogTitle
            >
            <DialogDescription>
              {{ successMessage }}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              @click="isSuccessDialogOpen = false"
              class="w-full bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 mt-2"
            >
              Entendi
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </div>
</template>
