import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/HttpStatus";
import fs from 'fs';
import path from "path";

const [MAX_RPM, MAX_RPD] = [2, 5];
const [DAY, MINUTE] = [86400, 60];

interface Userlimter {
    RPM: number; // Stores total req in current minute.
    RPD: number; // Stores total req in current day.
    lastDay: number;
    lastMinute: number;
}

function reset(userLimiter: Userlimter, minuteDiff: number, dayDiff: number): Userlimter {
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

    let userLimter: Userlimter | null = userIps[ip] ?? null;
    const seconds = Date.now() / 1000;
    const dayDiff: number = userLimter ? seconds - userLimter.lastDay : 0;
    const minuteDiff: number = userLimter ? seconds - userLimter.lastMinute : 0;

    if (!userLimter) {
        userLimter = {
            RPD: 0,
            RPM: 0,
            lastDay: seconds,
            lastMinute: seconds,
        } as Userlimter;
    } else if (dayDiff >= DAY) {
        userLimter = reset(userLimter, minuteDiff, dayDiff);
    } else if (minuteDiff >= MINUTE && userLimter.RPD < MAX_RPD) {
        userLimter = reset(userLimter, minuteDiff, dayDiff);
    } else if (userLimter.RPD >= MAX_RPD) {
        throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, "Per day limit is reached."); // Also unlock time in error
    } else if (userLimter.RPM >= MAX_RPM) {
        throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, "Per minute limit is reached. Please try after a minute."); // Also unlock time in error
    }

    userLimter.RPD += 1;
    userLimter.RPM += 1;
    userIps[ip] = userLimter;

    try {
        fs.truncateSync(outPath);
        fs.writeFileSync(outPath, JSON.stringify(userIps, null, 4));
    } catch (err) {
        throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, getErrorMessage(err));
    }
    next();
}
