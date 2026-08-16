/**
 * GYMBUDDY — SHARED NAVIGATION & SESSION CONTROLLER
 * Ensures reliable routing, active states, mobile drawer,
 * profile dropdown, notifications, and demo session actions across all pages.
 */

import { getUserProfile } from "./db.js";

export function showToast(message) {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "toast-notice";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

export function getActiveUser() {
  try {
    const raw = localStorage.getItem("gymbuddy_active_user") || localStorage.getItem("formcoach_demo_user");
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not parse active user:", e);
  }
  // Default Demo Athlete if none is explicitly set
  const defaultDemo = {
    uid: "demo-athlete-1",
    displayName: "Alex Johnson",
    email: "alex.demo@gymbuddy.ai",
    photoURL: null,
    isDemo: true,
  };
  localStorage.setItem("gymbuddy_active_user", JSON.stringify(defaultDemo));
  return defaultDemo;
}

export function initSharedNavigation(onUserReady) {
  // 1. SESSION INITIALIZATION
  const currentUser = getActiveUser();

  // Hydrate user profile from persistent local DB
  getUserProfile(currentUser.uid || "demo-athlete-1", currentUser).then((profile) => {
    hydrateNavProfile(profile);

    if (typeof onUserReady === "function") {
      onUserReady(profile, currentUser);
    }
  });

  // 2. DOM INTERACTION BINDINGS
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindNavControls();
    });
  } else {
    bindNavControls();
  }
}

function bindNavControls() {
  setupMobileSidebar();
  setupProfileDropdown();
  setupLogoutButtons();
  setupNotifications();
  highlightActiveNavLink();
}

function hydrateNavProfile(profile) {
  const displayName = profile.displayName || profile.name || "Athlete";
  const initial = displayName.charAt(0).toUpperCase();

  const welcomeUserName = document.getElementById("welcomeUserName");
  const headerUserName = document.getElementById("headerUserName");
  const headerUserAvatar = document.getElementById("headerUserAvatar");
  const dropdownUserFullName = document.getElementById("dropdownUserFullName");
  const dropdownUserEmail = document.getElementById("dropdownUserEmail");

  if (welcomeUserName) welcomeUserName.textContent = displayName;
  if (headerUserName) headerUserName.textContent = displayName;
  if (dropdownUserFullName) dropdownUserFullName.textContent = displayName;
  if (dropdownUserEmail) dropdownUserEmail.textContent = profile.email || "athlete@gymbuddy.ai";

  if (headerUserAvatar) {
    if (profile.photoURL) {
      headerUserAvatar.innerHTML = `<img src="${profile.photoURL}" alt="${displayName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
    } else {
      headerUserAvatar.textContent = initial;
    }
  }
}

function setupMobileSidebar() {
  const sidebar = document.getElementById("sidebar");
  const mobileSidebarToggle = document.getElementById("mobileSidebarToggle");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");

  const openSidebar = () => {
    sidebar?.classList.add("mobile-open");
    sidebarBackdrop?.classList.add("active");
    document.body.style.overflow = "hidden";
  };

  const closeSidebar = () => {
    sidebar?.classList.remove("mobile-open");
    sidebarBackdrop?.classList.remove("active");
    document.body.style.overflow = "";
  };

  mobileSidebarToggle?.addEventListener("click", openSidebar);
  sidebarBackdrop?.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar?.classList.contains("mobile-open")) {
      closeSidebar();
    }
  });
}

function setupProfileDropdown() {
  const profilePill = document.getElementById("profilePill");
  const profileDropdown = document.getElementById("profileDropdown");

  if (profilePill && profileDropdown) {
    profilePill.addEventListener("click", (e) => {
      e.stopPropagation();
      const isExpanded = profileDropdown.classList.toggle("show");
      profilePill.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    });

    document.addEventListener("click", (e) => {
      if (!profilePill.contains(e.target) && !profileDropdown.contains(e.target)) {
        profileDropdown.classList.remove("show");
        profilePill.setAttribute("aria-expanded", "false");
      }
    });
  }
}

function setupLogoutButtons() {
  const handleLogout = (e) => {
    e.preventDefault();
    localStorage.removeItem("gymbuddy_active_user");
    localStorage.removeItem("formcoach_demo_user");
    window.location.href = "login.html";
  };

  const sidebarLogoutBtn = document.getElementById("sidebarLogoutBtn");
  const dropdownLogoutBtn = document.getElementById("dropdownLogoutBtn");

  sidebarLogoutBtn?.addEventListener("click", handleLogout);
  dropdownLogoutBtn?.addEventListener("click", handleLogout);
}

function setupNotifications() {
  const notifBtn = document.getElementById("notificationBtn") || document.querySelector(".notification-btn");
  if (notifBtn) {
    notifBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showToast("3 Notifications: Form streak active (4 days), Protein goal 78% achieved, New community sprint open!");
    });
  }
}

function highlightActiveNavLink() {
  const currentPath = window.location.pathname.split("/").pop() || "dashboard.html";
  const navLinks = document.querySelectorAll(".sidebar-nav .nav-link, .sidebar-bottom .nav-link");

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (href && (href === currentPath || (currentPath === "" && href === "dashboard.html"))) {
      link.classList.add("active");
    } else if (href && href !== currentPath) {
      link.classList.remove("active");
    }
  });
}
