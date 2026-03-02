import { createRouter, createWebHistory } from "vue-router";

import { sessionState } from "./session";
import AdminPage from "./views/AdminPage.vue";
import ChangePasswordPage from "./views/ChangePasswordPage.vue";
import GameProfilesPage from "./views/GameProfilesPage.vue";
import GamesPage from "./views/GamesPage.vue";
import LayoutPage from "./views/LayoutPage.vue";
import LoginPage from "./views/LoginPage.vue";
import PeoplePage from "./views/PeoplePage.vue";
import ProfilePage from "./views/ProfilePage.vue";

const routes = [
  {
    path: "/login",
    name: "login",
    component: LoginPage,
    meta: { guestOnly: true },
  },
  {
    path: "/change-password",
    name: "change-password",
    component: ChangePasswordPage,
    meta: { requiresAuth: true },
  },
  {
    path: "/",
    component: LayoutPage,
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        redirect: "/people",
      },
      {
        path: "admin",
        name: "admin",
        component: AdminPage,
      },
      {
        path: "people",
        name: "people",
        component: PeoplePage,
      },
      {
        path: "game-profiles",
        name: "game-profiles",
        component: GameProfilesPage,
      },
      {
        path: "games",
        name: "games",
        component: GamesPage,
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
    return "/people";
  }
  return true;
});

export default router;

