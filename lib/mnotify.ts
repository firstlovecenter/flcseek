import { supabase } from './supabase';

const MNOTIFY_API_KEY = process.env.MNOTIFY_API_KEY;
const MNOTIFY_SENDER_ID = process.env.MNOTIFY_SENDER_ID || 'FLC';

export interface SMSResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export async function sendSMS(
  to: string,
  message: string,
  triggerType: string
): Promise<SMSResponse> {
  try {
    if (!MNOTIFY_API_KEY) {
      await logSMS(to, message, triggerType, 'failed', 'API key not configured');
      return { success: false, message: 'SMS API not configured' };
    }

    const response = await fetch('https://api.mnotify.com/api/sms/quick', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MNOTIFY_API_KEY}`,
      },
      body: JSON.stringify({
        recipient: [to],
        sender: MNOTIFY_SENDER_ID,
        message,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      await logSMS(to, message, triggerType, 'sent', JSON.stringify(data));
      return { success: true, data };
    } else {
      await logSMS(to, message, triggerType, 'failed', JSON.stringify(data));
      return { success: false, message: 'Failed to send SMS', data };
    }
  } catch (error: any) {
    await logSMS(to, message, triggerType, 'failed', error.message);
    return { success: false, message: error.message };
  }
}

async function logSMS(
  toPhone: string,
  message: string,
  triggerType: string,
  status: 'sent' | 'failed' | 'pending',
  response?: string
) {
  try {
    await supabase.from('sms_logs').insert({
      to_phone: toPhone,
      message,
      trigger_type: triggerType,
      status,
      response,
    });
  } catch (error) {
    console.error('Failed to log SMS:', error);
  }
}

export async function sendWelcomeSMS(name: string, phone: string) {
  const message = `Welcome to FLC, ${name}! We're excited to have you join our church family. May God bless you on your spiritual journey.`;
  return sendSMS(phone, message, 'registration');
}

export async function sendCompletionSMS(name: string, phone: string) {
  const message = `Congratulations ${name}! You've completed 26 church attendances. We're proud of your commitment to your faith journey!`;
  return sendSMS(phone, message, 'attendance_completion');
}

export async function sendStageCompletionSMS(
  name: string,
  phone: string,
  stageName: string
) {
  const message = `Great job ${name}! You've completed: ${stageName}. Keep growing in your faith!`;
  return sendSMS(phone, message, 'stage_completion');
}

export async function sendWeeklyReminder(name: string, phone: string) {
  const message = `Hi ${name}, this is a reminder from FLC. We look forward to seeing you at church this week. God bless you!`;
  return sendSMS(phone, message, 'weekly_reminder');
}
