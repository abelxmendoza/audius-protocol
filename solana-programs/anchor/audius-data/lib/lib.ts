/**
 * Library of typescript functions used in tests/CLI
 * Intended for later integration with libs
 */
import * as anchor from "@project-serum/anchor";
import { Program, Provider } from "@project-serum/anchor";
import { Keypair } from "@solana/web3.js";
import { Account } from "web3-core";
import * as secp256k1 from "secp256k1";
import { AudiusData } from "../target/types/audius_data";
import { signBytes, SystemSysVarProgramKey } from "./utils";
const { SystemProgram, Transaction, Secp256k1Program } = anchor.web3;

export const TrackSocialActionEnumValues = {
  addSave: { addSave: {} },
  deleteSave: { deleteSave: {} },
  addRepost: { addRepost: {} },
  deleteRepost: { deleteRepost: {} },
};

export const PlaylistSocialActionEnumValues = {
  addSave: { addSave: {} },
  deleteSave: { deleteSave: {} },
  addRepost: { addRepost: {} },
  deleteRepost: { deleteRepost: {} },
};

export const EntityTypesEnumValues = {
  track: { track: {} },
  playlist: { playlist: {} },
};

export const ManagementActions = {
  create: { create: {} },
  update: { update: {} },
  delete: { delete: {} },
};

type TrackSocialActionKeys = keyof typeof TrackSocialActionEnumValues;
type TrackSocialActionValues =
  typeof TrackSocialActionEnumValues[TrackSocialActionKeys];

type PlaylistSocialActionKeys = keyof typeof PlaylistSocialActionEnumValues;
type PlaylistSocialActionValues =
  typeof PlaylistSocialActionEnumValues[PlaylistSocialActionKeys];

/// Initialize an Audius Admin instance
type InitAdminParams = {
  provider: Provider;
  program: Program<AudiusData>;
  adminKeypair: Keypair;
  adminStgKeypair: Keypair;
  verifierKeypair: Keypair;
  playlistIdOffset: anchor.BN;
};

export const initAdmin = async ({
  provider,
  program,
  adminKeypair,
  adminStgKeypair,
  verifierKeypair,
  playlistIdOffset,
}: InitAdminParams) => {
  return program.rpc.initAdmin(
    adminKeypair.publicKey,
    verifierKeypair.publicKey,
    playlistIdOffset,
    {
      accounts: {
        admin: adminStgKeypair.publicKey,
        payer: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [adminStgKeypair],
    }
  );
};

/// Initialize a user from the Audius Admin account
type InitUserParams = {
  provider: Provider;
  program: Program<AudiusData>;
  ethAddress: string;
  handleBytesArray: number[];
  bumpSeed: number;
  metadata: string;
  userStgAccount: anchor.web3.PublicKey;
  baseAuthorityAccount: anchor.web3.PublicKey;
  adminStgKey: anchor.web3.PublicKey;
  adminKeypair: anchor.web3.Keypair;
};

export const initUser = async ({
  provider,
  program,
  ethAddress,
  handleBytesArray,
  bumpSeed,
  metadata,
  userStgAccount,
  baseAuthorityAccount,
  adminStgKey,
  adminKeypair,
}: InitUserParams) => {
  return program.rpc.initUser(
    baseAuthorityAccount,
    [...anchor.utils.bytes.hex.decode(ethAddress)],
    handleBytesArray,
    bumpSeed,
    metadata,
    {
      accounts: {
        admin: adminStgKey,
        payer: provider.wallet.publicKey,
        user: userStgAccount,
        authority: adminKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [adminKeypair],
    }
  );
};

/// Claim a user's account using given an eth private key
export type InitUserSolPubkeyParams = {
  provider: Provider;
  program: Program<AudiusData>;
  ethPrivateKey: string;
  message: Uint8Array;
  userSolPubkey: anchor.web3.PublicKey;
  userStgAccount: anchor.web3.PublicKey;
};

export const initUserSolPubkey = async ({
  provider,
  program,
  ethPrivateKey,
  message,
  userSolPubkey,
  userStgAccount,
}: InitUserSolPubkeyParams) => {
  const { signature, recoveryId } = signBytes(message, ethPrivateKey);

  // Get the public key in a compressed format
  const ethPubkey = secp256k1
    .publicKeyCreate(anchor.utils.bytes.hex.decode(ethPrivateKey), false)
    .slice(1);

  const tx = new Transaction();

  tx.add(
    Secp256k1Program.createInstructionWithPublicKey({
      publicKey: ethPubkey,
      message: message,
      recoveryId: recoveryId,
      signature: signature,
    })
  );

  tx.add(
    program.instruction.initUserSol(userSolPubkey, {
      accounts: {
        user: userStgAccount,
        sysvarProgram: SystemSysVarProgramKey,
      },
    })
  );

  return provider.send(tx);
};

/// Create a user without Audius Admin account
type CreateUserParams = {
  provider: Provider;
  program: Program<AudiusData>;
  ethAccount: Account;
  message: Uint8Array;
  handleBytesArray: number[];
  bumpSeed: number;
  metadata: string;
  userSolPubkey: anchor.web3.PublicKey;
  userStgAccount: anchor.web3.PublicKey;
  adminStgPublicKey: anchor.web3.PublicKey;
  baseAuthorityAccount: anchor.web3.PublicKey;
};

export const createUser = async ({
  baseAuthorityAccount,
  program,
  ethAccount,
  message,
  handleBytesArray,
  bumpSeed,
  metadata,
  provider,
  userSolPubkey,
  userStgAccount,
  adminStgPublicKey,
}: CreateUserParams) => {
  const { signature, recoveryId } = signBytes(message, ethAccount.privateKey);

  // Get the public key in a compressed format
  const ethPubkey = secp256k1
    .publicKeyCreate(
      anchor.utils.bytes.hex.decode(ethAccount.privateKey),
      false
    )
    .slice(1);

  const tx = new Transaction();
  tx.add(
    Secp256k1Program.createInstructionWithPublicKey({
      publicKey: ethPubkey,
      message: message,
      signature,
      recoveryId,
    })
  );
  tx.add(
    program.instruction.createUser(
      baseAuthorityAccount,
      [...anchor.utils.bytes.hex.decode(ethAccount.address)],
      handleBytesArray,
      bumpSeed,
      metadata,
      userSolPubkey,
      {
        accounts: {
          payer: provider.wallet.publicKey,
          user: userStgAccount,
          systemProgram: SystemProgram.programId,
          sysvarProgram: SystemSysVarProgramKey,
          audiusAdmin: adminStgPublicKey,
        },
      }
    )
  );

  return provider.send(tx);
};

/// Initialize a user from the Audius Admin account
type UpdateUserParams = {
  program: Program<AudiusData>;
  metadata: string;
  userStgAccount: anchor.web3.PublicKey;
  userDelegateAuthority: anchor.web3.PublicKey;
  userAuthorityKeypair: anchor.web3.Keypair;
};

export const updateUser = async ({
  program,
  metadata,
  userStgAccount,
  userAuthorityKeypair,
  userDelegateAuthority,
}: UpdateUserParams) => {
  return program.rpc.updateUser(metadata, {
    accounts: {
      user: userStgAccount,
      userAuthority: userAuthorityKeypair.publicKey,
      userDelegateAuthority,
    },
    signers: [userAuthorityKeypair],
  });
};

// Update Audius Admin account
type UpdateAdminParams = {
  program: Program<AudiusData>;
  isWriteEnabled: boolean;
  adminStgAccount: anchor.web3.PublicKey;
  adminAuthorityKeypair: anchor.web3.Keypair;
};

export const updateAdmin = async ({
  program,
  isWriteEnabled,
  adminStgAccount,
  adminAuthorityKeypair,
}: UpdateAdminParams) => {
  return program.rpc.updateAdmin(isWriteEnabled, {
    accounts: {
      admin: adminStgAccount,
      adminAuthority: adminAuthorityKeypair.publicKey,
    },
    signers: [adminAuthorityKeypair],
  });
};

/// Verify user with authenticatorKeypair
type UpdateIsVerifiedParams = {
  program: Program<AudiusData>;
  userStgAccount: anchor.web3.PublicKey;
  verifierKeypair: anchor.web3.Keypair;
  baseAuthorityAccount: anchor.web3.PublicKey;
  adminKeypair: Keypair;
  handleBytesArray: number[];
  bumpSeed: number;
};
export const updateIsVerified = async ({
  program,
  adminKeypair,
  userStgAccount,
  verifierKeypair,
  baseAuthorityAccount,
  handleBytesArray,
  bumpSeed,
}: UpdateIsVerifiedParams) => {
  return program.rpc.updateIsVerified(
    baseAuthorityAccount,
    { seed: handleBytesArray, bump: bumpSeed },
    {
      accounts: {
        user: userStgAccount,
        audiusAdmin: adminKeypair.publicKey,
        verifier: verifierKeypair.publicKey,
      },
      signers: [verifierKeypair],
    }
  );
};

/// Create a track
export type CreateTrackParams = {
  program: Program<AudiusData>;
  baseAuthorityAccount: anchor.web3.PublicKey;
  adminStgAccount: anchor.web3.PublicKey;
  handleBytesArray: number[];
  bumpSeed: number;
  userAuthorityKeypair: Keypair;
  userStgAccountPDA: anchor.web3.PublicKey;
  metadata: string;
  id: string;
};

export const createTrack = async ({
  id,
  program,
  baseAuthorityAccount,
  userAuthorityKeypair,
  userStgAccountPDA,
  metadata,
  handleBytesArray,
  adminStgAccount,
  bumpSeed,
}: CreateTrackParams) => {
  return program.rpc.manageEntity(
    baseAuthorityAccount,
    { seed: handleBytesArray, bump: bumpSeed },
    EntityTypesEnumValues.track,
    ManagementActions.create,
    id,
    metadata,
    {
      accounts: {
        audiusAdmin: adminStgAccount,
        user: userStgAccountPDA,
        authority: userAuthorityKeypair.publicKey,
      },
      signers: [userAuthorityKeypair],
    }
  );
};

/// Initialize a user from the Audius Admin account
type UpdateTrackParams = {
  program: Program<AudiusData>;
  baseAuthorityAccount: anchor.web3.PublicKey;
  adminStgAccount: anchor.web3.PublicKey;
  handleBytesArray: number[];
  bumpSeed: number;
  metadata: string;
  id: string;
  userAuthorityKeypair: Keypair;
  userStgAccountPDA: anchor.web3.PublicKey;
};

export const updateTrack = async ({
  program,
  baseAuthorityAccount,
  id,
  metadata,
  userAuthorityKeypair,
  userStgAccountPDA,
  handleBytesArray,
  adminStgAccount,
  bumpSeed,
}: UpdateTrackParams) => {
  return program.rpc.manageEntity(
    baseAuthorityAccount,
    { seed: handleBytesArray, bump: bumpSeed },
    EntityTypesEnumValues.track,
    ManagementActions.update,
    id,
    metadata,
    {
      accounts: {
        audiusAdmin: adminStgAccount,
        user: userStgAccountPDA,
        authority: userAuthorityKeypair.publicKey,
      },
      signers: [userAuthorityKeypair],
    }
  );
};

/// Initialize a user from the Audius Admin account
type DeleteTrackParams = {
  provider: Provider;
  program: Program<AudiusData>;
  id: string;
  userAuthorityKeypair: Keypair;
  userStgAccountPDA: anchor.web3.PublicKey;
  baseAuthorityAccount: anchor.web3.PublicKey;
  adminStgAccount: anchor.web3.PublicKey;
  handleBytesArray: number[];
  bumpSeed: number;
};

export const deleteTrack = async ({
  program,
  id,
  userStgAccountPDA,
  userAuthorityKeypair,
  baseAuthorityAccount,
  handleBytesArray,
  adminStgAccount,
  bumpSeed,
}: DeleteTrackParams) => {
  return program.rpc.manageEntity(
    baseAuthorityAccount,
    { seed: handleBytesArray, bump: bumpSeed },
    EntityTypesEnumValues.track,
    ManagementActions.delete,
    id,
    "", // Empty string for metadata in delete
    {
      accounts: {
        audiusAdmin: adminStgAccount,
        user: userStgAccountPDA,
        authority: userAuthorityKeypair.publicKey,
      },
      signers: [userAuthorityKeypair],
    }
  );
};

/// save a track
export type TrackSocialActionArgs = {
  program: Program<AudiusData>;
  baseAuthorityAccount: anchor.web3.PublicKey;
  userStgAccountPDA: anchor.web3.PublicKey;
  userAuthorityKeypair: Keypair;
  adminStgPublicKey: anchor.web3.PublicKey;
  handleBytesArray: number[];
  bumpSeed: number;
  trackSocialAction: TrackSocialActionValues;
  trackId: string;
};

export type PlaylistSocialActionArgs = {
  program: Program<AudiusData>;
  baseAuthorityAccount: anchor.web3.PublicKey;
  userStgAccountPDA: anchor.web3.PublicKey;
  userAuthorityKeypair: Keypair;
  adminStgPublicKey: anchor.web3.PublicKey;
  handleBytesArray: number[];
  bumpSeed: number;
  playlistSocialAction: PlaylistSocialActionValues;
  playlistId: anchor.BN;
};

export const writeTrackSocialAction = async ({
  program,
  baseAuthorityAccount,
  userStgAccountPDA,
  userAuthorityKeypair,
  handleBytesArray,
  bumpSeed,
  adminStgPublicKey,
  trackSocialAction,
  trackId,
}: TrackSocialActionArgs) => {
  return program.rpc.writeTrackSocialAction(
    baseAuthorityAccount,
    { seed: handleBytesArray, bump: bumpSeed },
    trackSocialAction,
    trackId,
    {
      accounts: {
        audiusAdmin: adminStgPublicKey,
        user: userStgAccountPDA,
        authority: userAuthorityKeypair.publicKey,
      },
      signers: [userAuthorityKeypair],
    }
  );
};

export const writePlaylistSocialAction = async ({
  program,
  baseAuthorityAccount,
  userStgAccountPDA,
  userAuthorityKeypair,
  handleBytesArray,
  bumpSeed,
  adminStgPublicKey,
  playlistSocialAction,
  playlistId,
}: PlaylistSocialActionArgs) => {
  return program.rpc.writePlaylistSocialAction(
    baseAuthorityAccount,
    { seed: handleBytesArray, bump: bumpSeed },
    playlistSocialAction,
    playlistId,
    {
      accounts: {
        audiusAdmin: adminStgPublicKey,
        user: userStgAccountPDA,
        authority: userAuthorityKeypair.publicKey,
      },
      signers: [userAuthorityKeypair],
    }
  );
};

/// Create a playlist
export type CreatePlaylistParams = {
  provider: Provider;
  program: Program<AudiusData>;
  newPlaylistKeypair: Keypair;
  userStgAccountPDA: anchor.web3.PublicKey;
  userAuthorityKeypair: Keypair;
  adminStgPublicKey: anchor.web3.PublicKey;
  metadata: string;
};

export const createPlaylist = async ({
  provider,
  program,
  newPlaylistKeypair,
  userStgAccountPDA,
  userAuthorityKeypair,
  adminStgPublicKey,
  metadata,
}: CreatePlaylistParams) => {
  return program.rpc.createPlaylist(metadata, {
    accounts: {
      playlist: newPlaylistKeypair.publicKey,
      user: userStgAccountPDA,
      authority: userAuthorityKeypair.publicKey,
      audiusAdmin: adminStgPublicKey,
      payer: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    },
    signers: [newPlaylistKeypair, userAuthorityKeypair],
  });
};

/// Update a playlist
export type UpdatePlaylistParams = {
  program: Program<AudiusData>;
  playlistPublicKey: anchor.web3.PublicKey;
  userStgAccountPDA: anchor.web3.PublicKey;
  userAuthorityKeypair: Keypair;
  metadata: string;
};

export const updatePlaylist = async ({
  program,
  playlistPublicKey,
  userStgAccountPDA,
  userAuthorityKeypair,
  metadata,
}: UpdatePlaylistParams) => {
  return program.rpc.updatePlaylist(metadata, {
    accounts: {
      playlist: playlistPublicKey,
      user: userStgAccountPDA,
      authority: userAuthorityKeypair.publicKey,
    },
    signers: [userAuthorityKeypair],
  });
};

/// Delete a playlist
export type DeletePlaylistParams = {
  provider: Provider;
  program: Program<AudiusData>;
  playlistPublicKey: anchor.web3.PublicKey;
  userStgAccountPDA: anchor.web3.PublicKey;
  userAuthorityKeypair: Keypair;
};

export const deletePlaylist = async ({
  provider,
  program,
  playlistPublicKey,
  userStgAccountPDA,
  userAuthorityKeypair,
}: DeletePlaylistParams) => {
  return program.rpc.deletePlaylist({
    accounts: {
      playlist: playlistPublicKey,
      user: userStgAccountPDA,
      authority: userAuthorityKeypair.publicKey,
      payer: provider.wallet.publicKey,
    },
    signers: [userAuthorityKeypair],
  });
};

/// Get keypair from secret key
export const getKeypairFromSecretKey = async (secretKey: Uint8Array) => {
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
};
