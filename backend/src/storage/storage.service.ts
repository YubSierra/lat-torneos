import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase;
  private bucket = 'player-photos';

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!, // usa SERVICE_KEY (no anon) para saltarse RLS
    );
  }

  async uploadPhoto(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const filePath = `${userId}.${ext}`;

    // Subir a Supabase Storage (si ya existe, lo reemplaza)
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: true, // sobreescribe si ya existe
      });

    if (error) throw new Error(`Error al subir foto: ${error.message}`);

    // Obtener URL pública
    const { data } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async deletePhoto(userId: string): Promise<void> {
    // Intentar borrar jpg y png (no sabemos cuál tiene)
    await this.supabase.storage
      .from(this.bucket)
      .remove([`${userId}.jpg`, `${userId}.png`]);
  }
}
