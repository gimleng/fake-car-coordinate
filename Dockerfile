# Use official Node.js LTS image
FROM node:24-alpine

# Create app directory
WORKDIR /app

# Copy package files first (for layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Expose the port your app uses
EXPOSE 8001

# Start the server
CMD ["node", "server.js"]