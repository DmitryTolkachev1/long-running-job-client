FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache apache2-utils

RUN rm -f /etc/nginx/conf.d/default.conf

RUN htpasswd -cb /etc/nginx/.htpasswd user password

COPY --from=build /app/dist/LongRunninJobClient/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]