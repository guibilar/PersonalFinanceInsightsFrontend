# Use official Node.js image to install dependencies and build the project
FROM node:20 as builder

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the Angular project files into the container
COPY . .

# Build the Angular application
RUN npm run build --prod

# Diagnostic step: List the /app/dist directory to verify build output
RUN echo "######### Contents of /app/dist #########" && ls -R /app/dist

# Use nginx to serve the built application
FROM nginx:1.25-alpine

# Expose port 5095
EXPOSE 5095

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from the previous stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Diagnostic step: List files in Nginx serving directory and check for index.html
RUN echo "######### Contents of /usr/share/nginx/html #########" && ls -R /usr/share/nginx/html && \
    if [ -f /usr/share/nginx/html/index.html ]; then echo "index.html FOUND"; else echo "index.html NOT FOUND"; fi

# Run nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
