# 🎨 FRONTEND INTEGRATION GUIDE

**Objetivo:** Guiar cómo estructurar el frontend (Vue, React, etc) para usar el SSO backend.

---

## 📋 ARQUITECTURA FRONTEND

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend App (Vue/React)                 │
├─────────────────────────────────────────────────────────────┤
│  Pages                                                       │
│  ├── LoginPage          → signin endpoint                    │
│  ├── SignupPage         → signup endpoint                    │
│  ├── TenantSelectPage   → GET /api/tenant                   │
│  ├── DashboardPage      → App-specific logic                │
│  └── SettingsPage       → User profile, team mgmt           │
│                                                              │
│  API Client (axios/fetch)                                    │
│  ├── AuthService        → JWT token management              │
│  ├── TenantService      → Tenant CRUD                       │
│  ├── UserService        → User profile                      │
│  └── ApiClient          → HTTP interceptors                 │
│                                                              │
│  State Management (Vuex/Redux/Pinia)                         │
│  ├── auth module        → JWT, user, refresh                │
│  ├── tenant module      → selected tenant, members          │
│  └── ui module          → loading, errors                   │
│                                                              │
│  Storage                                                     │
│  ├── localStorage       → selectedTenant, user info         │
│  └── sessionStorage     → accessToken (optional)            │
│                                                              │
│  HTTP Interceptors                                           │
│  ├── Request            → Add Authorization header          │
│  ├── Request            → Add X-Tenant-ID header            │
│  ├── Response 401       → Refresh token                     │
│  └── Response 403       → Show permission error             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 IMPLEMENTACIÓN PASO A PASO

### PASO 1: Configurar API Client

**Archivo: `src/api/client.ts` o `src/services/api.ts`**

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.VUE_APP_API_URL || 'http://localhost:3000';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor: Add Authorization header
    this.client.interceptors.request.use((config) => {
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      // Add X-Tenant-ID if available
      const tenantId = localStorage.getItem('selectedTenant');
      if (tenantId) {
        config.headers['X-Tenant-ID'] = tenantId;
      }

      return config;
    });

    // Interceptor: Handle 401 (token expired)
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config;

        // Si es 401 y no es un retry, intentar refresh
        if (error.response?.status === 401 && !config?._retry) {
          config._retry = true;

          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
              throw new Error('No refresh token available');
            }

            // Call refresh endpoint
            const response = await this.client.post('/api/auth/refresh-token', {
              refreshToken,
            });

            const { accessToken } = response.data;
            localStorage.setItem('accessToken', accessToken);

            // Retry original request with new token
            if (config.headers) {
              config.headers.Authorization = `Bearer ${accessToken}`;
            }
            return this.client(config);
          } catch (refreshError) {
            // Refresh failed, logout
            this.logout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // ─────────────────────────────────────────────────────────
  // AUTH METHODS
  // ─────────────────────────────────────────────────────────

  async signup(email: string, firstName: string, lastName: string, password: string) {
    const response = await this.client.post('/api/auth/signup', {
      email,
      firstName,
      lastName,
      password,
    });
    return response.data;
  }

  async signin(email: string, password: string) {
    const response = await this.client.post('/api/auth/signin', {
      email,
      password,
    });

    const { user, accessToken, refreshToken } = response.data;

    // Store tokens
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));

    return { user, accessToken, refreshToken };
  }

  async logout() {
    try {
      await this.client.post('/api/auth/logout');
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      // Clear storage anyway
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('selectedTenant');
      localStorage.removeItem('user');
    }
  }

  // ─────────────────────────────────────────────────────────
  // TENANT METHODS
  // ─────────────────────────────────────────────────────────

  async getTenants() {
    const response = await this.client.get('/api/tenant');
    return response.data.tenants;
  }

  async createTenant(name: string, description?: string) {
    const response = await this.client.post('/api/tenant', {
      name,
      description,
    });
    return response.data;
  }

  async getTenantDetails(tenantId: string) {
    const response = await this.client.get(`/api/tenant/${tenantId}`);
    return response.data;
  }

  async inviteTenantMember(
    tenantId: string,
    email: string,
    role: 'admin' | 'member' | 'viewer'
  ) {
    const response = await this.client.post(
      `/api/tenant/${tenantId}/members`,
      { email, role }
    );
    return response.data;
  }

  async getTenantMembers(tenantId: string) {
    const response = await this.client.get(
      `/api/tenant/${tenantId}/members`
    );
    return response.data.members;
  }

  async updateMemberRole(
    tenantId: string,
    memberId: string,
    role: 'admin' | 'member' | 'viewer'
  ) {
    const response = await this.client.put(
      `/api/tenant/${tenantId}/members/${memberId}`,
      { role }
    );
    return response.data;
  }

  async removeTenantMember(tenantId: string, memberId: string) {
    const response = await this.client.delete(
      `/api/tenant/${tenantId}/members/${memberId}`
    );
    return response.data;
  }

  // ─────────────────────────────────────────────────────────
  // UTILITY
  // ─────────────────────────────────────────────────────────

  getStoredUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  getStoredTenant() {
    return localStorage.getItem('selectedTenant');
  }

  setSelectedTenant(tenantId: string) {
    localStorage.setItem('selectedTenant', tenantId);
  }

  isAuthenticated() {
    return !!localStorage.getItem('accessToken');
  }
}

export default new ApiClient();
```

---

### PASO 2: State Management (Pinia - Vue 3)

**Archivo: `src/stores/authStore.ts`**

```typescript
import { defineStore } from 'pinia';
import apiClient from '@/api/client';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenants: Tenant[];
}

interface Tenant {
  id: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  selectedTenant: Tenant | null;
  isLoading: boolean;
  error: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: apiClient.getStoredUser(),
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
    selectedTenant: null,
    isLoading: false,
    error: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.accessToken,
    currentUser: (state) => state.user,
    currentTenant: (state) => state.selectedTenant,
  },

  actions: {
    async signup(email: string, firstName: string, lastName: string, password: string) {
      this.isLoading = true;
      this.error = null;

      try {
        const result = await apiClient.signup(email, firstName, lastName, password);
        // Usuario creado, pero no autenticado aún
        // Enviar a verificación de email
        return result;
      } catch (error: any) {
        this.error = error.response?.data?.message || 'Signup failed';
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async signin(email: string, password: string) {
      this.isLoading = true;
      this.error = null;

      try {
        const { user, accessToken, refreshToken } = await apiClient.signin(
          email,
          password
        );

        this.user = user;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;

        return user;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Signin failed';
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async logout() {
      this.isLoading = true;

      try {
        await apiClient.logout();
      } finally {
        this.user = null;
        this.accessToken = null;
        this.refreshToken = null;
        this.selectedTenant = null;
        this.isLoading = false;
      }
    },

    setSelectedTenant(tenant: Tenant) {
      this.selectedTenant = tenant;
      apiClient.setSelectedTenant(tenant.id);
    },
  },
});
```

**Archivo: `src/stores/tenantStore.ts`**

```typescript
import { defineStore } from 'pinia';
import apiClient from '@/api/client';

interface TenantMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
  createdAt: string;
}

interface TenantState {
  tenants: Tenant[];
  selectedTenant: Tenant | null;
  members: TenantMember[];
  isLoading: boolean;
  error: string | null;
}

export const useTenantStore = defineStore('tenant', {
  state: (): TenantState => ({
    tenants: [],
    selectedTenant: null,
    members: [],
    isLoading: false,
    error: null,
  }),

  getters: {
    currentTenant: (state) => state.selectedTenant,
    tenantMembers: (state) => state.members,
  },

  actions: {
    async fetchTenants() {
      this.isLoading = true;
      this.error = null;

      try {
        this.tenants = await apiClient.getTenants();
      } catch (error: any) {
        this.error = error.response?.data?.message || 'Failed to fetch tenants';
      } finally {
        this.isLoading = false;
      }
    },

    async createTenant(name: string, description?: string) {
      this.isLoading = true;
      this.error = null;

      try {
        const newTenant = await apiClient.createTenant(name, description);
        this.tenants.push(newTenant);
        return newTenant;
      } catch (error: any) {
        this.error = error.response?.data?.message || 'Failed to create tenant';
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async selectTenant(tenantId: string) {
      const tenant = this.tenants.find((t) => t.id === tenantId);
      if (tenant) {
        this.selectedTenant = tenant;
        apiClient.setSelectedTenant(tenantId);

        // Fetch members of this tenant
        await this.fetchTenantMembers(tenantId);
      }
    },

    async fetchTenantMembers(tenantId: string) {
      this.isLoading = true;
      this.error = null;

      try {
        this.members = await apiClient.getTenantMembers(tenantId);
      } catch (error: any) {
        this.error = error.response?.data?.message || 'Failed to fetch members';
      } finally {
        this.isLoading = false;
      }
    },

    async inviteMember(
      tenantId: string,
      email: string,
      role: 'admin' | 'member' | 'viewer'
    ) {
      this.isLoading = true;
      this.error = null;

      try {
        const result = await apiClient.inviteTenantMember(tenantId, email, role);
        // Refresh members list
        await this.fetchTenantMembers(tenantId);
        return result;
      } catch (error: any) {
        this.error = error.response?.data?.message || 'Failed to invite member';
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async updateMemberRole(
      tenantId: string,
      memberId: string,
      role: 'admin' | 'member' | 'viewer'
    ) {
      this.isLoading = true;
      this.error = null;

      try {
        await apiClient.updateMemberRole(tenantId, memberId, role);
        // Refresh members list
        await this.fetchTenantMembers(tenantId);
      } catch (error: any) {
        this.error = error.response?.data?.message || 'Failed to update role';
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async removeMember(tenantId: string, memberId: string) {
      this.isLoading = true;
      this.error = null;

      try {
        await apiClient.removeTenantMember(tenantId, memberId);
        // Remove from local list
        this.members = this.members.filter((m) => m.id !== memberId);
      } catch (error: any) {
        this.error = error.response?.data?.message || 'Failed to remove member';
        throw error;
      } finally {
        this.isLoading = false;
      }
    },
  },
});
```

---

### PASO 3: Login Page Component

**Archivo: `src/pages/LoginPage.vue`**

```vue
<template>
  <div class="login-container">
    <form @submit.prevent="handleLogin">
      <h1>Sign In</h1>

      <!-- Error Message -->
      <div v-if="error" class="alert alert-error">
        {{ error }}
      </div>

      <!-- Email Input -->
      <div class="form-group">
        <label for="email">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          @keyup.enter="handleLogin"
        />
      </div>

      <!-- Password Input -->
      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          @keyup.enter="handleLogin"
        />
      </div>

      <!-- Submit Button -->
      <button type="submit" :disabled="isLoading">
        {{ isLoading ? 'Signing in...' : 'Sign In' }}
      </button>

      <!-- Links -->
      <div class="links">
        <router-link to="/signup">Don't have an account? Sign up</router-link>
        <router-link to="/forgot-password">Forgot password?</router-link>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useTenantStore } from '@/stores/tenantStore';

const router = useRouter();
const authStore = useAuthStore();
const tenantStore = useTenantStore();

const email = ref('');
const password = ref('');
const isLoading = ref(false);
const error = ref('');

const handleLogin = async () => {
  isLoading.value = true;
  error.value = '';

  try {
    await authStore.signin(email.value, password.value);

    // Fetch user's tenants
    await tenantStore.fetchTenants();

    // If user has only one tenant, auto-select it
    if (tenantStore.tenants.length === 1) {
      await tenantStore.selectTenant(tenantStore.tenants[0].id);
      router.push('/dashboard');
    } else {
      // Redirect to tenant selection
      router.push('/select-tenant');
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Login failed';
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  max-width: 400px;
  margin: 50px auto;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

h1 {
  margin-bottom: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

label {
  margin-bottom: 5px;
  font-weight: bold;
}

input {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  padding: 10px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.links {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  margin-top: 10px;
}

.links a {
  color: #007bff;
  text-decoration: none;
}

.alert-error {
  padding: 10px;
  background-color: #f8d7da;
  color: #721c24;
  border-radius: 4px;
}
</style>
```

---

### PASO 4: Tenant Selection Page

**Archivo: `src/pages/TenantSelectPage.vue`**

```vue
<template>
  <div class="tenant-select-container">
    <h1>Select a Workspace</h1>

    <div v-if="isLoading" class="loading">Loading...</div>

    <div v-else-if="tenants.length === 0" class="no-tenants">
      <p>You don't have any workspaces yet.</p>
      <router-link to="/create-tenant">Create one</router-link>
    </div>

    <div v-else class="tenants-grid">
      <div
        v-for="tenant in tenants"
        :key="tenant.id"
        class="tenant-card"
        @click="selectTenant(tenant.id)"
      >
        <h2>{{ tenant.name }}</h2>
        <p>Role: <strong>{{ tenant.role }}</strong></p>
        <button>Select</button>
      </div>
    </div>

    <button class="create-btn">+ Create New Workspace</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useTenantStore } from '@/stores/tenantStore';

const router = useRouter();
const tenantStore = useTenantStore();

const tenants = computed(() => tenantStore.tenants);
const isLoading = computed(() => tenantStore.isLoading);

const selectTenant = async (tenantId: string) => {
  await tenantStore.selectTenant(tenantId);
  router.push('/dashboard');
};
</script>

<style scoped>
.tenant-select-container {
  max-width: 800px;
  margin: 40px auto;
  padding: 20px;
}

.tenants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.tenant-card {
  padding: 20px;
  border: 2px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tenant-card:hover {
  border-color: #007bff;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.2);
}

.create-btn {
  padding: 12px 24px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
```

---

### PASO 5: Environment Variables

**Archivo: `.env.local`**

```
VUE_APP_API_URL=http://localhost:3000
VUE_APP_ENV=development
```

---

## 🔄 FLUJO COMPLETO - Frontend

```
1. User accede a /login
   ↓
2. User ingresa email + password
   ↓
3. POST /api/auth/signin
   Response: { user, accessToken, refreshToken }
   ↓
4. Frontend guarda tokens en localStorage
   ↓
5. Frontend redirige a /select-tenant
   ↓
6. GET /api/tenant (obtiene lista de tenants del usuario)
   ↓
7. User selecciona un tenant
   ↓
8. Frontend guarda tenantId en localStorage
   ↓
9. Frontend redirige a /dashboard
   ↓
10. Todos los requests incluyen:
    - Authorization: Bearer <accessToken>
    - X-Tenant-ID: <tenantId>
    ↓
11. Si accessToken expira (401):
    POST /api/auth/refresh-token
    Response: { newAccessToken }
    ↓
12. Frontend guarda nuevo token
    Reinténta request original
    ↓
13. User puede cambiar de tenant en cualquier momento
    Set localStorage['selectedTenant'] = newTenantId
    Headers automáticamente usan el nuevo tenantId
```

---

## 🛡️ Security Best Practices

### ✅ HACER:
- [ ] Guardar accessToken en localStorage (stateless, refrescable)
- [ ] Guardar refreshToken en httpOnly cookie (más seguro)
- [ ] Usar HTTPS en producción (encrypt tokens in transit)
- [ ] Validar X-Tenant-ID en cada request
- [ ] Mostrar errores genéricos al user (no filtrar info)
- [ ] Rate-limit login attempts
- [ ] Logout automático después de inactividad
- [ ] Refresh token antes de que expire (background)

### ❌ NO HACER:
- ❌ Guardar tokens en sessionStorage (accesible en dev tools)
- ❌ Guardar sensitive info en localStorage (accesible al JS)
- ❌ Pasar tokens en URL (logs, history)
- ❌ Confiar SOLO en frontend validation
- ❌ Exponer JWT payload como UI data source
- ❌ Guardar refresh token con accessToken en localStorage

---

## 📦 Dependencias Necesarias

```bash
npm install \
  axios \
  pinia \
  vue-router \
  @vueuse/core

npm install --save-dev \
  @types/node \
  typescript
```

---

## 🎯 Conclusión

Tu frontend está listo para:
1. ✅ Autenticación completa (signup, signin, logout)
2. ✅ Multi-tenant support (seleccionar, cambiar)
3. ✅ Token refresh automático
4. ✅ Permission-based UI (mostrar/ocultar según role)
5. ✅ Error handling robusto

El backend SSO manejará toda la lógica, el frontend solo consume la API.
