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

# Compilar React para producción
RUN npm run build

# Instalar servidor estático
RUN npm install -g serve

# Exponer el puerto
EXPOSE 5173

# Servir la aplicación compilada
CMD ["serve", "-s", "dist", "-l", "5173"]