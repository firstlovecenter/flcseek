import { prisma } from './prisma';
import { SavedSearchFilters, SearchFilter } from './types/advanced-features';
import { logger } from './logger';

/**
 * Manage saved searches for users
 * Handles CRUD operations, filtering, and search execution
 */

export class SavedSearchesService {
  /**
   * Create a new saved search
   */
  static async createSavedSearch(
    userId: string,
    name: string,
    filters: SavedSearchFilters,
    options?: {
      description?: string;
      isSmart?: boolean;
      isPublic?: boolean;
    }
  ) {
    try {
      const savedSearch = await prisma.savedSearch.create({
        data: {
          userId,
          name,
          description: options?.description,
          filters: JSON.parse(JSON.stringify(filters)),
          isSmart: options?.isSmart ?? false,
          isPublic: options?.isPublic ?? false,
        },
      });

      logger.info('Saved search created', {
        searchId: savedSearch.id,
        userId,
        name,
      });

      return savedSearch;
    } catch (error) {
      logger.error('SavedSearches: Error creating saved search', {
        userId,
        name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get saved search by ID
   */
  static async getSavedSearch(searchId: string) {
    try {
      const savedSearch = await prisma.savedSearch.findUnique({
        where: { id: searchId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return savedSearch;
    } catch (error) {
      logger.error('SavedSearches: Error fetching saved search', {
        searchId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get all saved searches for a user
   */
  static async getUserSavedSearches(userId: string, groupId?: string) {
    try {
      const searches = await prisma.savedSearch.findMany({
        where: {
          userId,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      // Filter by group if specified (stored in filters)
      if (groupId) {
        return searches.filter((search) => {
          const filters = search.filters as unknown as SavedSearchFilters;
          const groupFilter = (filters.filters as SearchFilter[]).some(
            (f) => f.field === 'groupId' && f.value === groupId
          );
          return groupFilter;
        });
      }

      return searches;
    } catch (error) {
      logger.error('SavedSearches: Error fetching user searches', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get public saved searches (shared with team)
   */
  static async getPublicSearches(groupId?: string) {
    try {
      const searches = await prisma.savedSearch.findMany({
        where: {
          isPublic: true,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      return searches;
    } catch (error) {
      logger.error('SavedSearches: Error fetching public searches', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update saved search
   */
  static async updateSavedSearch(
    searchId: string,
    updates: {
      name?: string;
      description?: string;
      filters?: SavedSearchFilters;
      isSmart?: boolean;
      isPublic?: boolean;
    }
  ) {
    try {
      const savedSearch = await prisma.savedSearch.update({
        where: { id: searchId },
        data: {
          name: updates.name,
          description: updates.description,
          filters: updates.filters ? JSON.parse(JSON.stringify(updates.filters)) : undefined,
          isSmart: updates.isSmart,
          isPublic: updates.isPublic,
          updatedAt: new Date(),
        },
      });

      logger.info('Saved search updated', {
        searchId,
        updates: Object.keys(updates),
      });

      return savedSearch;
    } catch (error) {
      logger.error('SavedSearches: Error updating saved search', {
        searchId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Delete saved search
   */
  static async deleteSavedSearch(searchId: string) {
    try {
      await prisma.savedSearch.delete({
        where: { id: searchId },
      });

      logger.info('Saved search deleted', { searchId });
    } catch (error) {
      logger.error('SavedSearches: Error deleting saved search', {
        searchId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Share a saved search with team (make it public)
   */
  static async shareSearch(searchId: string) {
    try {
      const savedSearch = await prisma.savedSearch.update({
        where: { id: searchId },
        data: {
          isPublic: true,
        },
      });

      logger.info('Saved search shared', { searchId });
      return savedSearch;
    } catch (error) {
      logger.error('SavedSearches: Error sharing search', {
        searchId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Unshare a saved search (make it private)
   */
  static async unshareSearch(searchId: string) {
    try {
      const savedSearch = await prisma.savedSearch.update({
        where: { id: searchId },
        data: {
          isPublic: false,
        },
      });

      logger.info('Saved search unshared', { searchId });
      return savedSearch;
    } catch (error) {
      logger.error('SavedSearches: Error unsharing search', {
        searchId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Duplicate a saved search
   */
  static async duplicateSearch(searchId: string, userId: string, newName: string) {
    try {
      const original = await prisma.savedSearch.findUnique({
        where: { id: searchId },
      });

      if (!original) {
        throw new Error('Search not found');
      }

      const duplicate = await prisma.savedSearch.create({
        data: {
          userId,
          name: newName,
          description: original.description,
          filters: original.filters as never,
          isSmart: original.isSmart,
          isPublic: false,
        },
      });

      logger.info('Saved search duplicated', {
        originalId: searchId,
        newId: duplicate.id,
      });

      return duplicate;
    } catch (error) {
      logger.error('SavedSearches: Error duplicating search', {
        searchId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get smart searches (auto-updating filters)
   */
  static async getSmartSearches(userId: string) {
    try {
      const searches = await prisma.savedSearch.findMany({
        where: {
          userId,
          isSmart: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return searches;
    } catch (error) {
      logger.error('SavedSearches: Error fetching smart searches', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get recently used searches
   */
  static async getRecentSearches(userId: string, limit: number = 5) {
    try {
      const searches = await prisma.savedSearch.findMany({
        where: {
          userId,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: limit,
      });

      return searches;
    } catch (error) {
      logger.error('SavedSearches: Error fetching recent searches', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Bulk delete old searches
   */
  static async deleteOldSearches(daysOld: number = 90) {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const result = await prisma.savedSearch.deleteMany({
        where: {
          updatedAt: {
            lt: cutoffDate,
          },
          isPublic: false, // Don't delete public searches
        },
      });

      logger.info('Old saved searches deleted', {
        count: result.count,
        daysOld,
      });

      return result;
    } catch (error) {
      logger.error('SavedSearches: Error deleting old searches', {
        daysOld,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
