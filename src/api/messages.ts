// Messages: send, list, hide, delete, and listen for changes in real time.
import { supabase } from './client';
import type { Tables, TablesInsert } from './database.types';
import { throwIfError, unwrap } from './errors';
import { deleteMedia, uploadLocalFile } from './media';

export type MessageType = 'photo' | 'voice' | 'text';
export type Message = Tables<'messages'>;

/** Newest first. Admins and aides also get hidden messages (check `message.hidden`). */
export async function listMessages(familyId: string, limit = 50): Promise<Message[]> {
  return unwrap(
    await supabase()
      .from('messages')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .limit(limit),
  );
}

export async function sendTextMessage(familyId: string, text: string): Promise<Message> {
  return insertMessage({ family_id: familyId, type: 'text', caption: text.trim() });
}

export async function sendPhotoMessage(
  familyId: string,
  localUri: string,
  caption?: string,
): Promise<Message> {
  return sendFileMessage(familyId, 'photo', localUri, caption);
}

export async function sendVoiceMessage(familyId: string, localUri: string): Promise<Message> {
  return sendFileMessage(familyId, 'voice', localUri);
}

async function sendFileMessage(
  familyId: string,
  type: 'photo' | 'voice',
  localUri: string,
  caption?: string,
): Promise<Message> {
  const filePath = await uploadLocalFile(familyId, localUri);
  try {
    return await insertMessage({
      family_id: familyId,
      type,
      file_path: filePath,
      caption: caption?.trim() || null,
    });
  } catch (error) {
    // Don't leave an orphaned file in storage if the message itself failed.
    await deleteMedia(filePath).catch(() => {});
    throw error;
  }
}

async function insertMessage(
  row: TablesInsert<'messages'> & { type: MessageType },
): Promise<Message> {
  // sender_id and created_at are filled in by the database.
  return unwrap(
    await supabase()
      .from('messages')
      .insert(row)
      .select()
      .single(),
  );
}

/** Admins and aides only: hide a message from the tablet, or show it again. */
export async function setMessageHidden(messageId: string, hidden: boolean): Promise<void> {
  throwIfError(await supabase().from('messages').update({ hidden }).eq('id', messageId));
}

/** Senders can delete their own messages; admins can delete any. */
export async function deleteMessage(message: Message): Promise<void> {
  throwIfError(await supabase().from('messages').delete().eq('id', message.id));
  if (message.file_path) {
    await deleteMedia(message.file_path).catch(() => {});
  }
}

/**
 * Calls `onChange()` whenever a message in the family is added, changed or deleted.
 * The callback gets no data on purpose: reload with listMessages, which is simpler
 * and always correct. Returns a function that stops listening.
 */
export function subscribeToMessages(familyId: string, onChange: () => void): () => void {
  const client = supabase();
  const channel = client
    .channel(`messages:${familyId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages', filter: `family_id=eq.${familyId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
