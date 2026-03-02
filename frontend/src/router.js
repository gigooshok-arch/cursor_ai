import { createRouter, createWebHistory } from "vue-router";

import { sessionState } from "./session";
import DashboardPage from "./views/DashboardPage.vue";
import LayoutPage from "./views/LayoutPage.vue";
import LoginPage from "./views/LoginPage.vue";
import ProfilePage from "./views/ProfilePage.vue";
import ProfilesPage from "./views/ProfilesPage.vue";

const routes = [
  {
    path: "/login",
    name: "login",
    component: LoginPage,
    meta: { guestOnly: true },
  },
  {
    path: "/",
    component: LayoutPage,
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        redirect: "/dashboard",
      },
      {
        path: "dashboard",
        name: "dashboard",
        component: DashboardPage,
      },
      {
        path: "profiles",
        name: "profiles",
        component: ProfilesPage,
      },
      {
        path: "profile/:entityType/:id",
        name: "profile",
        component: ProfilePage,
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const isAuthed = Boolean(sessionState.token);
  if (to.meta.requiresAuth && !isAuthed) {
    return "/login";
  }
  if (to.meta.guestOnly && isAuthed) {
    return "/dashboard";
  }
  return true;
});

export default router;

