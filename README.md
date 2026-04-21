<h1 align="center">🧪 Electronics Lab Inventory System</h1>

<p align="center">
  <b>Full-Stack | Dockerized | DevOps Ready</b><br>
  Inventory management system for an electronics laboratory
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Docker-Containerized-blue?logo=docker"/>
  <img src="https://img.shields.io/badge/Angular-Frontend-red?logo=angular"/>
  <img src="https://img.shields.io/badge/Node.js-Backend-green?logo=node.js"/>
  <img src="https://img.shields.io/badge/MySQL-Database-orange?logo=mysql"/>
  <img src="https://img.shields.io/badge/Status-Active-success"/>
</p>

---

## 🚀 Overview

This project is a **full-stack web application** designed to manage an electronics laboratory inventory efficiently.
It integrates **frontend, backend, database, and containerization** into a complete system ready for real-world environments.

---

## ✨ Key Features

* 🔐 Authentication & role management (Admin / Auxiliar / Student)
* 📦 Inventory control and tracking
* 🔄 Loan and return system
* 🔍 Smart search and filtering
* 📊 Organization by categories and academic areas

---

## 🧠 Architecture

```mermaid
flowchart LR
    A[Angular Frontend] --> B[Node.js API]
    B --> C[MySQL Database]
    B --> D[Docker Containers]
```

---

## 🛠️ Tech Stack

| Layer      | Technology              |
| ---------- | ----------------------- |
| Frontend   | Angular                 |
| Backend    | Node.js + Express       |
| Database   | MySQL                   |
| DevOps     | Docker & Docker Compose |
| Versioning | Git + GitHub            |

---

## 🐳 Run with Docker

### 1. Clone the repository

```bash
git clone https://github.com/Robert1401/lab-inventory-system-docker.git
cd lab-inventory-system-docker
```

---

### 2. Start containers

```bash
docker-compose up --build
```

---

### 3. Access the application

Open your browser and go to:

http://localhost:8081/public/Login/index.html

---

## 📂 Project Structure

```text
backend/        → REST API (Node.js)
frontend/       → Angular application
db/             → Database configuration
docker-compose.yml
```

---

## 👥 User Roles

| Role     | Permissions          |
| -------- | -------------------- |
| Admin    | Full system control  |
| Auxiliar | Inventory management |
| Student  | Request materials    |

---

## 📸 System Preview

<img width="1357" height="633" alt="Screenshot_1624" src="https://github.com/user-attachments/assets/5549bdc2-c585-473d-8273-318e23e7fc6e" />
<img width="1357" height="633" alt="Screenshot_1625" src="https://github.com/user-attachments/assets/41d27d5e-bab0-4e42-964b-41d271cd1c24" />
<img width="1357" height="633" alt="Screenshot_1626" src="https://github.com/user-attachments/assets/f36749cd-6c90-4993-a644-c0cb6f9ac27f" />
<img width="1357" height="633" alt="Screenshot_1627" src="https://github.com/user-attachments/assets/97beaac9-94d4-4c01-9b40-16a07f0ecf5f" />


---

## 🧪 DevOps & CI/CD

* Docker containerization
* Docker Compose orchestration
* GitLab CI/CD pipeline integration

---

## 📌 Notes

* Make sure Docker is running
* Verify port 8081 is available
* Use `docker ps` to verify containers

---

## 👨‍💻 Author

**Roberto Aram López Rodríguez**
Ingeniería en Sistemas Computacionales
Instituto Tecnológico de Saltillo

---

## ⭐ Support

If you like this project, consider giving it a ⭐ on GitHub!
