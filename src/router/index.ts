import { createRouter, createWebHistory } from 'vue-router'
import ArchiveWorkspaceView from '../views/ArchiveWorkspaceView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'overview', component: ArchiveWorkspaceView },
    { path: '/projects/:projectId/checklist-items', name: 'checklist', component: ArchiveWorkspaceView },
    { path: '/projects/:projectId/documents', name: 'documents', component: ArchiveWorkspaceView },
    { path: '/projects/:projectId/archives', name: 'archives', component: ArchiveWorkspaceView },
    { path: '/projects/:projectId/archive-questions', name: 'questions', component: ArchiveWorkspaceView },
    { path: '/projects/:projectId/archive-agent', name: 'archive-agent', component: ArchiveWorkspaceView },
    { path: '/projects/:projectId/audit-logs', name: 'audit', component: ArchiveWorkspaceView },
    { path: '/projects/:projectId/settings', name: 'settings', component: ArchiveWorkspaceView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
