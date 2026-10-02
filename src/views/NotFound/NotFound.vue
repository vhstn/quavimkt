<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import {
  Boxes,
  ArrowLeft,
  LayoutDashboard,
  LogIn,
} from "lucide-vue-next";

const router = useRouter();

const isAuthenticated = computed(() => {
  return !!localStorage.getItem("@MktApp:token");
});

const handleNavigateHome = () => {
  if (isAuthenticated.value) {
    router.push("/dashboard");
  } else {
    router.push("/login");
  }
};

const handleGoBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    handleNavigateHome();
  }
};
</script>

<template>
  <div
    class="min-h-screen bg-gradient-to-br from-soft-green via-green-50 to-vibrant-green/20 flex items-center justify-center p-4"
  >
    <div
      class="bg-white rounded-2xl shadow-lg p-8 md:p-10 w-full max-w-lg text-center"
    >
      <div class="flex justify-center mb-6">
        <div class="p-3 bg-soft-green/30 rounded-2xl">
          <Boxes class="w-10 h-10 text-vibrant-green" />
        </div>
      </div>

      <h1
        class="text-7xl font-extrabold text-vibrant-green tracking-tight font-mono"
      >
        404
      </h1>

      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-900 mb-2">
          Página não encontrada
        </h2>
        <p class="text-gray-600 text-sm md:text-base leading-relaxed">
          Ops! A página que você tentou acessar não existe, foi removida ou o
          endereço digitado está incorreto.
        </p>
      </div>

      <div class="space-y-3">
        <button
          type="button"
          @click="handleNavigateHome"
          class="w-full bg-vibrant-green hover:bg-vibrant-green/90 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-vibrant-green focus:ring-offset-2 flex items-center justify-center space-x-2 shadow-sm"
        >
          <LayoutDashboard v-if="isAuthenticated" class="w-5 h-5" />
          <LogIn v-else class="w-5 h-5" />
          <span>
            {{
              isAuthenticated
                ? "Voltar para o Dashboard"
                : "Voltar para o Login"
            }}
          </span>
        </button>

        <button
          type="button"
          @click="handleGoBack"
          class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          <ArrowLeft class="w-4 h-4" />
          <span>Voltar à página anterior</span>
        </button>
      </div>
    </div>
  </div>
</template>
