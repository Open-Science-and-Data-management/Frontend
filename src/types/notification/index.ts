import { z } from "zod";
import {
  notificationSchema,
  createNotificationSchema,
} from "@/schemas/notification";

// Export types generated from Zod schemas
export type Notification = z.infer<typeof notificationSchema>;
export type CreateNotification = z.infer<typeof createNotificationSchema>;

// Re-export shared enums used by Notification for convenience
export { NotificationType } from "@/schemas/shared";
