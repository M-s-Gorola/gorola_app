# GoRola — Local Development & Partner Portals

This directory contains reference quick links and default local credentials for the GoRola developer environment.

---

## 🌐 Subdomain Routing & Portals

GoRola uses advanced subdomain resolution to separate the **Buyer Storefront**, **Store Partner Portal**, **Rider App**, and **System Admin Portal**.

### 1. Subdomain Modes (Production / E2E / Custom DNS)
When your hostname supports subdomains (e.g. via local hosts setup `127.0.0.1 store.gorola.com` or in production), GoRola resolves:

*   **Store Partner Portal**: [http://store.gorola.com:5180/](http://store.gorola.com:5180/) (or `store.gorola.in`)
*   **System Admin Portal**: [http://admin.gorola.com:5180/](http://admin.gorola.com:5180/) (or `admin.gorola.in`)
*   **Rider Portal**: [http://rider.gorola.com:5180/](http://rider.gorola.com:5180/) (or `rider.gorola.in`)

### 2. Local Fallback Modes (Query Parameters)
If you are developing locally on a clean machine without custom DNS, you can dynamically toggle portals on `localhost` using URL query parameters:

*   **Activate Store Portal**: [http://localhost:5180?_subdomain=store](http://localhost:5180?_subdomain=store)
*   **Activate Admin Portal**: [http://localhost:5180?_subdomain=admin](http://localhost:5180?_subdomain=admin)
*   **Activate Rider Portal**: [http://localhost:5180?_subdomain=rider](http://localhost:5180?_subdomain=rider)
*   **Restore to Buyer Storefront**: [http://localhost:5180?_subdomain=clear](http://localhost:5180?_subdomain=clear)

### 3. Backward-Compatible Paths
Standard path-based routing continues to function seamlessly as fallbacks:

*   **Store Portal Login**: [http://localhost:5180/store/login](http://localhost:5180/store/login)

---

## 🏬 Seeded Store Owner Accounts

You can log in to any of the following seeded store owner profiles:

| Store Name | Email Address | Password | Store Type | Scoped Authorized Actions |
|---|---|---|---|---|
| **Hillside Mart** | `owner1@gorola.in` | `Owner#123` | `QUICK_COMMERCE` | Scoped strictly to Hillside Mart catalog, orders, and dashboard KPIs. |
| **Mountain Medico** | `owner2@gorola.in` | `Owner#123` | `QUICK_COMMERCE` | Scoped strictly to Mountain Medico catalog, orders, and dashboard KPIs. |
| **Aarna Diagnostic Centre** | `owner3@gorola.in` | `Owner#123` | `BOOKING_COMMERCE` | Scoped strictly to booking approvals, schedules, and diagnostic test services. |
| **GoRola Electronics** | `owner4@gorola.in` | `Owner#123` | `QUICK_COMMERCE` | Scoped strictly to electronics products catalog, stock, and dashboard KPIs. |
| **GoRola Repairs** | `owner5@gorola.in` | `Owner#123` | `BOOKING_COMMERCE` | Scoped strictly to doorstep repair approvals, technician scheduling, and timeslot management. |

---

## ⚙️ Administrative Portal (Reference)

* *Note: The full admin panels and permissions are managed in the subsequent phases. You can document the default admin credentials and portals in this section once they are fully implemented.*
