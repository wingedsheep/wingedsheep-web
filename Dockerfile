# Build the static site, then serve it with nginx.
# The 3D models in public/models are committed, so the build doesn't need Blender.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
# compressed once, at the strongest setting, for nginx's gzip_static (the models above all:
# island.glb goes from 10.7 MB to about 2)
RUN find dist -type f -size +1k \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' \
      -o -name '*.xml' -o -name '*.svg' -o -name '*.txt' -o -name '*.glb' \) -exec gzip -9 -k {} +

FROM nginx:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/headers.conf /etc/nginx/headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
# lets the deploy workflow check which commit is live
ARG GIT_SHA=dev
RUN echo "$GIT_SHA" > /usr/share/nginx/html/version.txt
