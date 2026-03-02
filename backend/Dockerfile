# Imagen base de Node.js
FROM node:20-alpine

# Crear carpeta de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --legacy-peer-deps

# Copiar el resto del código
COPY . .

# Compilar TypeScript a JavaScript
RUN npm run build

# Exponer el puerto
EXPOSE 3000

# Iniciar la aplicación compilada
CMD ["node", "dist/main.js"]
