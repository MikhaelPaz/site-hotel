// db/schema.ts
// -----------------------------------------------------------------------
// Define a estrutura da tabela "bookings" (reservas) no banco de dados,
// usando o Drizzle ORM. Este arquivo é a "fonte da verdade" do esquema:
// a partir dele são gerados os arquivos SQL de migração (veja a pasta
// drizzle/, com o arquivo 0000_foamy_roughhouse.sql).
//
// Repare que a tabela guarda só os campos mais importantes/buscados em
// colunas próprias; o restante dos detalhes da reserva (camas, posto,
// desconto, etc.) fica dentro da coluna "data", como um texto JSON —
// isso é decidido e montado em app/api/reservas/route.ts.
// -----------------------------------------------------------------------

import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const bookings = sqliteTable(
  'bookings',
  {
    id: text('id').primaryKey(), // identificador único = "protocolo" mostrado ao hóspede
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    start: text('start').notNull(), // data de entrada, formato AAAA-MM-DD
    end: text('end').notNull(), // data de saída, formato AAAA-MM-DD
    purpose: text('purpose').notNull(), // 'geral' | 'saude' | 'comando'
    room: text('room'), // preenchido só depois que a reserva é aprovada
    status: text('status').notNull().default('Pendente'),
    data: text('data').notNull(), // demais detalhes, guardados como texto JSON
    created: text('created').notNull(), // data/hora de criação (ISO 8601)
    updatedBy: text('updated_by'), // quem fez a última alteração de status
    // Hóspede (tabela "guests") a quem a reserva pertence. Os campos name,
    // email e phone acima continuam guardando o que foi digitado NAQUELA
    // reserva (histórico); o cadastro único do hóspede fica em "guests".
    guestId: text('guest_id'),
  },
  // Índices: aceleram as consultas mais comuns feitas pelo sistema.
  (t) => [
    // Usado ao aprovar uma reserva, para checar rapidamente se já existe
    // outra reserva no mesmo quarto com datas conflitantes.
    index('idx_bookings_room_dates').on(t.room, t.start, t.end),
    // Usado para listar reservas filtrando por situação e ordenando
    // pela mais recente (é assim que a aba "Reservas" do painel funciona).
    index('idx_bookings_status_created').on(t.status, t.created),
    // Usado para mostrar o histórico de reservas de cada hóspede.
    index('idx_bookings_guest').on(t.guestId),
  ],
);

// -----------------------------------------------------------------------
// Tabela "guests" (hóspedes): cadastro de quem já solicitou reserva.
//
// Um registro por hóspede. A cada nova reserva, o sistema procura o
// hóspede pela "key" (e-mail + nome, sem diferença entre maiúsculas e
// minúsculas, veja guestKey em lib/guests.ts): se já existe, só atualiza
// o telefone/nome/e-mail para o mais recente; se não existe, cria.
// Usada pela aba "Hóspedes" do painel (app/equipe/hospedes.tsx).
// -----------------------------------------------------------------------
export const guests = sqliteTable(
  'guests',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(), // chave de identificação (e-mail|nome), única
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    created: text('created').notNull(), // primeira vez que apareceu (ISO 8601)
    updated: text('updated').notNull(), // última reserva/atualização (ISO 8601)
  },
  (t) => [uniqueIndex('idx_guests_key').on(t.key)],
);

// -----------------------------------------------------------------------
// Tabela "users": os LOGINS da área da equipe (/equipe).
//
// Gerenciada pela página de administração (/equipe/admin). A senha NUNCA
// é guardada em texto: só o hash (PBKDF2, veja lib/auth.ts).
//   role   -> 'admin' (pode gerenciar logins) | 'equipe' (só usa o painel)
//   active -> 1 = pode entrar | 0 = bloqueado (sem apagar o cadastro)
// -----------------------------------------------------------------------
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(), // usuário de login: minúsculo, sem espaços; único
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull().default('equipe'),
    active: integer('active').notNull().default(1),
    created: text('created').notNull(),
    updated: text('updated').notNull(),
    lastLogin: text('last_login'),
  },
  (t) => [uniqueIndex('idx_users_username').on(t.username)],
);

// -----------------------------------------------------------------------
// Tabela "sessions": quem está logado agora. O cookie do navegador guarda
// um código aleatório; aqui fica só o hash dele (token_hash). Apagar a
// linha desloga a pessoa na hora (usado ao remover/bloquear um login).
// -----------------------------------------------------------------------
export const sessions = sqliteTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id').notNull(),
    created: text('created').notNull(),
    expires: text('expires').notNull(), // ISO 8601
  },
  (t) => [index('idx_sessions_user').on(t.userId)],
);

// -----------------------------------------------------------------------
// Tabela "receipts": COMPROVANTE DE PAGAMENTO de cada reserva (um por
// reserva), anexado na aba "Controle orçamentário". O arquivo (PDF ou
// imagem, até ~1,3 MB) é guardado em base64 na coluna "data".
// -----------------------------------------------------------------------
export const receipts = sqliteTable('receipts', {
  bookingId: text('booking_id').primaryKey(),
  fileName: text('file_name').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(), // tamanho do arquivo original, em bytes
  data: text('data').notNull(), // conteúdo em base64
  uploaded: text('uploaded').notNull(), // ISO 8601
  uploadedBy: text('uploaded_by'), // usuário que anexou
});
