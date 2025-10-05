# Stage 1: Build the Angular application
FROM node:20-alpine AS build-stage

# Set the working directory
WORKDIR /app

# Install Angular CLI globally to ensure we can build the Angular app
RUN npm install -g @angular/cli@20.3.3

# Copy package.json and package-lock.json for dependency installation
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application source code to the container
COPY . .

# Debug and verify Angular build process
RUN ng version && ng build --configuration production

# Stage 2: Serve the application using nginx
FROM nginx:1.25-alpine AS production-stage

# Copy built files from the build stage to the nginx HTML folder
COPY --from=build-stage /app/dist/PersonalFinancesFrontend/ /usr/share/nginx/html/

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 5095 to serve the application
EXPOSE 5095

# Start nginx when the container starts
CMD ["nginx", "-g", "daemon off;"]
