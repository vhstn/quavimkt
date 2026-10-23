<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import {
  LayoutDashboard,
  FileText,
  Building2,
  BarChart3,
  Settings,
  LogOut,
  Users,
  Boxes,
  Share2,
} from "lucide-vue-next";

const route = useRoute();
const router = useRouter();

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", page: "dashboard" },
  { icon: Users, label: "Times", page: "teams" },
  { icon: FileText, label: "Postagens", page: "posts" },
  { icon: Share2, label: "Publicações", page: "publications" },
  { icon: Building2, label: "Campanhas", page: "campaigns" },
  { icon: BarChart3, label: "Relatórios", page: "analytics" },
  { icon: Settings, label: "Configurações", page: "settings" },
];

const isActive = (page: string) => {
  return route.path.includes(page);
};

const handleLogout = () => {
  localStorage.removeItem("@MktApp:token");
  router.push("/login");
};
</script>

<template>
  <div class="w-64 bg-white shadow-sm border-r border-gray-200 h-screen sticky top-0">
    <div class="p-6">
      <div class="flex items-center space-x-2">
        <Boxes class="w-8 h-8 text-vibrant-green" />
        <span class="text-xl font-semibold text-gray-900">Dashboard</span>
      </div>
    </div>
    
    <nav class="mt-6">
      <button
        v-for="(item, index) in sidebarItems"
        :key="index"
        @click="router.push(`/${item.page}`)"
        :class="[
          'flex items-center px-6 py-3 text-sm font-medium transition-colors duration-200 w-full text-left',
          isActive(item.page)
            ? 'text-vibrant-green bg-soft-green/30 border-r-2 border-vibrant-green'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        ]"
      >
        <component :is="item.icon" class="w-5 h-5 mr-3" />
        {{ item.label }}
      </button>
    </nav>

    <div class="absolute bottom-6 left-6">
      <button 
        @click="handleLogout"
        class="flex items-center text-sm text-gray-600 hover:text-red-600 transition-colors duration-200"
      >
        <LogOut class="w-4 h-4 mr-2" />
        Sair
      </button>
    </div>
  </div>
</template>
