import { and, eq } from "drizzle-orm";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { boardCollaborators, db, projects } from "@/db";

// How a user relates to a board: its creator, or someone else with access (an invited collaborator on a personal board,
// or any other member of the team workspace the board belongs to).
export type BoardRole = "owner" | "collaborator";

// The signed-in user's Clerk role in an organization ("org:admin" / "org:member"), or null if they aren't a member.
// The active organization is answered from the session token; any other org costs one Clerk API call.
const getOrgRole = async (orgId: string) => {
    const { userId, orgId: activeOrgId, orgRole } = await auth();
    if (!userId) return null;
    if (activeOrgId === orgId) return orgRole ?? "org:member";

    const clerk = await clerkClient();
    const { data } = await clerk.users.getOrganizationMembershipList({ userId, limit: 100 });
    return data.find((membership) => membership.organization.id === orgId)?.role ?? null;
};

// Resolves what the user may do on a board, or null if they can't open it.
//  - Team board (orgId set): any member of that Clerk organization can open and edit it.
//  - Personal board: the owner, or someone the owner invited by email.
// `canManage` (rename, pin, archive, publish, delete) is the creator, plus workspace admins on team boards.
export const getBoardAccess = async (email: string, projectId: string) => {
    const [board] = await db
        .select()
        .from(projects)
        .where(eq(projects.projectId, projectId))
        .limit(1);

    if (!board) return null;

    const isCreator = board.userEmail === email;

    if (board.orgId) {
        const orgRole = await getOrgRole(board.orgId);
        if (!orgRole) return null;

        return {
            board,
            role: (isCreator ? "owner" : "collaborator") as BoardRole,
            canManage: isCreator || orgRole === "org:admin",
        };
    }

    if (isCreator) return { board, role: "owner" as BoardRole, canManage: true };

    const [invite] = await db
        .select({ id: boardCollaborators.id })
        .from(boardCollaborators)
        .where(and(eq(boardCollaborators.projectId, projectId), eq(boardCollaborators.email, email.toLowerCase())))
        .limit(1);

    return invite ? { board, role: "collaborator" as BoardRole, canManage: false } : null;
};

// Deterministic cursor/avatar colour for a user id, so everyone sees the same colour for the same person.
const CURSOR_COLORS = ["#e03131", "#e8590c", "#f08c00", "#2f9e44", "#0c8599", "#1971c2", "#6741d9", "#c2255c"];
export const getUserColor = (userId: string) => {
    let hash = 0;
    for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return CURSOR_COLORS[hash % CURSOR_COLORS.length];
};
