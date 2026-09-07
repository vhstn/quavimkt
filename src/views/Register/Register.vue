<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { Boxes, Loader2, User, Mail, Lock, Eye, EyeOff } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";

const router = useRouter();
const fullName = ref("");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const isLoading = ref(false);
const errorMessage = ref("");
const isErrorDialogOpen = ref(false);

const handleRegister = async () => {
  if (
    !fullName.value ||
    !email.value ||
    !password.value ||
    !confirmPassword.value
  )
    return;

  if (password.value !== confirmPassword.value) {
    errorMessage.value = "As senhas não coincidem.";
    isErrorDialogOpen.value = true;
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const response = await apiFetch("/identity/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: fullName.value,
        email: email.value,
        password: password.value,
      }),
    });

    if (!response.ok) {
      const rawText = await response.text();
      let apiMessage = "Erro ao criar conta. Tente novamente.";

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
        const rawText = await response.text();
        let apiMessage = "Erro ao efetuar login. Tente novamente.";

        if (rawText) {
          try {
            const errorData = JSON.parse(rawText);
            apiMessage =
              errorData.message ||
              errorData.detail ||
              errorData.title ||
              rawText;
          } catch {
            apiMessage = rawText;
          }
        }
        throw new Error(apiMessage);
      }

      const data = await response.json();

      localStorage.setItem("@MktApp:token", data.token);
    } catch (error: any) {
      errorMessage.value = error.message || "Falha ao conectar com o servidor.";
      isErrorDialogOpen.value = true;
    } finally {
      router.push("dashboard");
    }
  } catch (error: any) {
    errorMessage.value = error.message || "Falha ao conectar com o servidor.";
    isErrorDialogOpen.value = true;
  }

  isLoading.value = false;
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
          Crie sua conta
        </h1>
        <p class="text-gray-600 text-sm">
          Preencha os dados abaixo para começar
        </p>
      </div>

      <form class="space-y-5" @submit.prevent="handleRegister">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Nome Completo</label
          >
          <div class="relative">
            <User class="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              v-model="fullName"
              placeholder="João Silva"
              class="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent outline-none transition-all"
              required
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >E-mail</label
          >
          <div class="relative">
            <Mail class="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="email"
              v-model="email"
              placeholder="seu@email.com"
              class="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vibrant-green focus:border-transparent outline-none transition-all"
              required
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Senha</label
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
            >Confirmar Senha</label
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
          :disabled="isLoading"
          class="w-full bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-3 rounded-lg transition-all flex justify-center items-center disabled:opacity-50"
        >
          <Loader2 v-if="isLoading" class="w-5 h-5 mr-2 animate-spin" />
          {{ isLoading ? "Criando conta..." : "Cadastrar" }}
        </button>
      </form>

      <div class="text-center mt-6">
        <p class="text-sm text-gray-600">
          Já tem uma conta?
          <router-link
            to="/login"
            class="text-vibrant-green hover:underline font-medium"
            >Faça login</router-link
          >
        </p>
      </div>

      <Dialog v-model:open="isErrorDialogOpen">
        <DialogContent>
          <DialogHeader>
            <DialogTitle class="text-red-600">Erro no Cadastro</DialogTitle>
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
</template>
