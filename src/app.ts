import express from 'express';
import cors from 'cors';
import { testRouter } from './routes/test.route';
import { resumeRouter } from './routes/resume.route';
import requestLogger from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors({ origin: "*" }));

// For parsing all req bodies into object
app.use(express.json());

app.use(requestLogger);

app.use("/test", testRouter);
app.use("/resume", resumeRouter);

app.use(errorHandler);

export default app;