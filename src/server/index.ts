import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { createAppContext } from './app.ts';
import { seedDevelopmentData } from './db/seed-dev.ts';

async function bootstrap() {
  const ctx = createAppContext();
  const { app, config, db, attachErrorHandler } = ctx;
  const httpServer = http.createServer(app);

  if (!config.isProduction && config.FEATURE_ENABLE_DEV_SEED) {
    seedDevelopmentData(db, { isProduction: false });
  }

  if (!config.isProduction) {
    const vitePkgName = 'vite';
    const viteModule = (await import(vitePkgName)) as {
      createServer: (opts: Record<string, unknown>) => Promise<{
        middlewares: express.RequestHandler;
      }>;
    };
    const vite = await viteModule.createServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const clientDistDir = path.resolve(process.cwd(), 'dist/client');
    if (fs.existsSync(clientDistDir)) {
      app.use(express.static(clientDistDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(clientDistDir, 'index.html'));
      });
    }
  }

  attachErrorHandler();

  httpServer.listen(config.PORT, config.HOST, () => {
    console.log(
      `[اورژانس خودرو] سرور یکپارچه در محیط ${config.APP_ENV} روی http://${config.HOST}:${config.PORT} آماده بهره‌برداری است.`
    );
  });

  const shutdown = () => {
    httpServer.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('[خطای راه‌اندازی سرور اورژانس خودرو]', err);
  process.exit(1);
});
