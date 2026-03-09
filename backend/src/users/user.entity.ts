import { Entity, PrimaryGeneratedColumn, Column,
         CreateDateColumn } from 'typeorm';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN       = 'admin',
  REFEREE     = 'referee',
  PLAYER      = 'player',
  CLUB_ADMIN  = 'club_admin',
}

@Entity('users')
export class User {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.PLAYER,
  })
  role: UserRole;

  // Datos personales para facturación
  @Column({ nullable: true })
  nombres: string;

  @Column({ nullable: true })
  apellidos: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  direccion: string;

  @Column({ nullable: true, unique: true })
  docNumber: string;

  @Column({ nullable: true })
  birthDate: Date;

  @Column({ nullable: true })
  gender: string;

  @Column({ default: true })
  isActive: boolean;

  // Si es primer login debe cambiar contraseña
  @Column({ default: false })
  mustChangePassword: boolean;

  @Column({ nullable: true })
  photoUrl: string;

  @CreateDateColumn()
  createdAt: Date;

}
