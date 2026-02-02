FROM node:22-alpine

WORKDIR /app

# Copiamos package primero para cache
COPY package*.json ./

# Instala deps
RUN npm install --only=production

# Copia el resto del código
COPY . .

# Puerto backend
EXPOSE 3000

# Arranque correcto
CMD ["node", "server.js"]
