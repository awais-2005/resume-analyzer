import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/HttpStatus";
import fs from 'fs';
import path from "path";

const [MAX_RPM, MAX_RPD] = [2, 5];
const [DAY, MINUTE] = [86400, 60];

interface UserLimiter {
    RPM: number; // Stores total req in current minute.
    RPD: number; // Stores total req in current day.
    lastDay: number;
    lastMinute: number;
}

function reset(userLimiter: UserLimiter, minuteDiff: number, dayDiff: number): UserLimiter {
    return {
        RPD: dayDiff >= DAY ? 0 : userLimiter.RPD,
        RPM: dayDiff >= DAY || minuteDiff >= MINUTE ? 0 : userLimiter.RPM,
        lastMinute: dayDiff >= DAY || minuteDiff >= MINUTE ? userLimiter.lastMinute + minuteDiff : userLimiter.lastMinute,
        lastDay: dayDiff >= DAY ? userLimiter.lastDay + dayDiff : userLimiter.lastDay,
    }
}

function getErrorMessage(err: any): string {
    return err instanceof Error ? err.message : typeof err === "string" ? err : "Something went wrong";
}

export default function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip;
    if (!ip) throw new ApiError(HttpStatus.FORBIDDEN, "Ip address is not found.");

    const outPath = path.resolve(process.cwd(), "rateLimit/userRequests.json");
    if (!fs.existsSync(outPath)) {
        try {
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, '{}');
        } catch (err) {
            throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, getErrorMessage(err));
        }
    }

    let userIps;
    try {
        const jsonString = fs.readFileSync(outPath, 'utf8');
        if (!jsonString) throw new Error("File is empty.");
        userIps = JSON.parse(jsonString);
    } catch (err) {
        throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, getErrorMessage(err));
    }

    let userLimiter: UserLimiter | null = userIps[ip] ?? null;
    const now = Date.now() / 1000;
    const dayDiff: number = userLimiter ? now - userLimiter.lastDay : 0;
    const minuteDiff: number = userLimiter ? now - userLimiter.lastMinute : 0;

    if (!userLimiter) {
        userLimiter = {
            RPD: 0,
            RPM: 0,
            lastDay: now,
            lastMinute: now,
        } as UserLimiter;
    } else if (dayDiff >= DAY) {
        userLimiter = reset(userLimiter, minuteDiff, dayDiff);
    } else if (minuteDiff >= MINUTE && userLimiter.RPD < MAX_RPD) {
        userLimiter = reset(userLimiter, minuteDiff, dayDiff);
    } else if (userLimiter.RPD >= MAX_RPD) {
        throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, "Per day limit is reached."); // Also unlock time in error
    } else if (userLimiter.RPM >= MAX_RPM) {
        throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, "Per minute limit is reached. Please try after a minute."); // Also unlock time in error
    }

    userLimiter.RPD += 1;
    userLimiter.RPM += 1;
    userIps[ip] = userLimiter;

    try {
        fs.truncateSync(outPath);
        fs.writeFileSync(outPath, JSON.stringify(userIps, null, 4));
    } catch (err) {
        throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, getErrorMessage(err));
    }
    next();
}
