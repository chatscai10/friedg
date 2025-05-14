import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import express from 'express';

const app = express();

app.get('/ping', (req, res) => {
  logger.info('Simple Ping received!', {structuredData: true});
  res.status(200).send('Simple Pong from Gen 2!');
});

export const simpleApi = onRequest(app);