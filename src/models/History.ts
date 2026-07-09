import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IHistory extends Document {
  userId: Types.ObjectId;
  title: string;
  prevScore: number;
  newScore?: number | null;
  unfixedResume: string;
  fixedResume?: string | null;
  analysisSnapshot?: string | null;
  timestamp: Date;
}

export const HistorySchema = new Schema<IHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'Resume Analysis',
    },
    prevScore: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    newScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    unfixedResume: {
      type: String,
      required: true,
      trim: true,
    },
    fixedResume: {
      type: String,
      trim: true,
      default: null,
    },
    // JSON snapshot of the Gemini analysis + resumeContent, captured at
    // analysis time. Lets a user reopen/reuse a past analysis later without
    // paying for another Gemini call.
    analysisSnapshot: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const History =
  mongoose.models.History || mongoose.model<IHistory>('History', HistorySchema);
