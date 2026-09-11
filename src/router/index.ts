import { createRouter, createWebHistory } from "vue-router";
import Login from "../views/Login/Login.vue";
import Register from "@/views/Register/Register.vue";
import ResetPassword from "@/views/Login/ResetPassword.vue";
import Dashboard from "../views/Dashboard/Dashboard.vue";
import Teams from "@/views/Teams/Teams.vue";
import Posts from "@/views/Posts/Posts.vue";
import Campaigns from "@/views/Campaigns/Campaigns.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/login",
    },
    {
      path: "/login",
      name: "Login",
      component: Login,
    },
    {
      path: "/register",
      name: "Register",
      component: Register,
    },
    {
      path: "/reset-password",
      name: "ResetPassword",
      component: ResetPassword,
    },
    {
      path: "/dashboard",
      name: "Dashboard",
      component: Dashboard,
      meta: { requiresAuth: true },
    },
    {
      path: "/teams",
      name: "Teams",
      component: Teams,
      meta: { requiresAuth: true },
    },
    {
      path: "/posts",
      name: "Posts",
      component: Posts,
      meta: { requiresAuth: true },
    },
    {
      path: "/campaigns",
      name: "Campaigns",
      component: Campaigns,
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("@MktApp:token");

  if (to.meta.requiresAuth && !token) {
    next("/login");
  } else if (to.path === "/login" && token) {
    next("/dashboard");
  } else {
    next();
  }
});

export default router;
