FROM node:24-bookworm
WORKDIR /app

COPY . .
RUN npm ci
RUN npm run build --if-present

ENV PORT=3000
ENV DB_FILE=/app/data/lviv.db
RUN mkdir -p /app/data
EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "@lcn/server"]