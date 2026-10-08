// Generated from packages/api-contract/openapi.json. Do not edit.
package io.nahhasio.client.generated

import kotlinx.serialization.Serializable

@Serializable
data class Error(
    val message: String,
)

@Serializable
data class User(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
)

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

@Serializable
data class Session(
    val user: User,
    val expiresAt: String,
)

@Serializable
data class LoginResponse(
    val token: String,
    val user: User,
    val expiresAt: String,
)

@Serializable
data class Artwork(
    val id: String,
    val url: String,
    val mimeType: String,
    val width: Long,
    val height: Long,
    val byteSize: Long,
    val sha256: String,
    val originalFilename: String,
    val focalX: Long,
    val focalY: Long,
)

@Serializable
data class ArtworkAssignment(
    val id: String,
    val url: String,
    val mimeType: String,
    val width: Long,
    val height: Long,
    val role: String,
    val isPrimary: Boolean,
    val byteSize: Long,
    val sha256: String,
    val originalFilename: String,
    val focalX: Long,
    val focalY: Long,
)

@Serializable
data class Vocabulary(
    val id: String,
    val slug: String,
    val labelEn: String,
    val labelAr: String,
    val descriptionEn: String,
    val descriptionAr: String,
)

@Serializable
data class ExternalIds(
    val tmdbId: Long?,
    val imdbId: String?,
    val anilistId: Long?,
    val malId: Long?,
)

@Serializable
data class Scores(
    val story: Double?,
    val characters: Double?,
    val depth: Double?,
    val worldBuilding: Double?,
    val originality: Double?,
    val craft: Double?,
    val updatedAt: String,
)

@Serializable
data class Classification(
    val audience: String,
    val age: String,
    val sexualityRisk: String,
    val behavioralRisk: String,
    val theologyRisk: String,
)

@Serializable
data class MediaTrack(
    val id: String,
    val kind: String,
    val streamIndex: Long,
    val language: String?,
    val codec: String?,
    val title: String?,
    val isDefault: Boolean,
    val isForced: Boolean,
)

@Serializable
data class MediaFile(
    val id: String,
    val durationSeconds: Long?,
    val jellyfinLinked: Boolean,
    val tracks: List<MediaTrack>,
)

@Serializable
data class Episode(
    val id: String,
    val number: String,
    val position: Long,
    val title: String?,
    val summary: String,
    val releaseDate: String?,
    val runtimeMinutes: Long?,
    val releaseState: String,
    val hasMediaFile: Boolean,
    val classification: Classification,
    val artwork: List<ArtworkAssignment>,
    val mediaFiles: List<MediaFile>,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class ClassificationOverrides(
    val audience: String?,
    val age: String?,
    val sexualityRisk: String?,
    val behavioralRisk: String?,
    val theologyRisk: String?,
)

@Serializable
data class ExternalReference(
    val id: String,
    val provider: String,
    val externalId: String,
    val url: String?,
)

@Serializable
data class Installment(
    val id: String,
    val kind: String,
    val position: Long,
    val title: String,
    val summary: String,
    val releaseDate: String?,
    val runtimeMinutes: Long?,
    val status: String,
    val externalIds: ExternalIds,
    val scores: Scores?,
    val hasMediaFile: Boolean,
    val artwork: List<ArtworkAssignment>,
    val episodes: List<Episode>,
    val classification: Classification,
    val classificationOverrides: ClassificationOverrides,
    val releaseState: String,
    val externalReferences: List<ExternalReference>,
    val mediaFiles: List<MediaFile>,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class WorkSummary(
    val id: String,
    val canonicalTitle: String,
    val titleAr: String?,
    val summary: String,
    val releaseYear: Long?,
    val format: String,
    val audience: String,
    val age: String,
    val poster: Artwork?,
    val installmentCount: Long,
    val episodeCount: Long,
)

@Serializable
data class Alias(
    val title: String,
    val language: String?,
    val isPreferred: Boolean,
    val id: String,
    val script: String?,
)

@Serializable
data class EntityAlias(
    val alias: String,
    val language: String?,
)

@Serializable
data class Contribution(
    val id: String,
    val name: String,
    val kind: String,
    val role: String,
    val roleLabelEn: String,
    val roleLabelAr: String,
    val description: String,
    val aliases: List<EntityAlias>,
    val artwork: List<ArtworkAssignment>,
    val isPrimary: Boolean,
    val position: Long,
    val roleId: String,
    val roleDescriptionEn: String,
    val roleDescriptionAr: String,
)

@Serializable
data class Relation(
    val id: String,
    val workId: String,
    val canonicalTitle: String,
    val titleAr: String?,
    val kind: String,
    val direction: String,
    val notes: String,
)

@Serializable
data class Planet(
    val id: String,
    val slug: String,
    val nameAr: String,
    val nameEn: String?,
    val icon: String,
    val description: String,
    val primaryColor: String,
    val secondaryColor: String,
    val featuredRank: Long?,
)

@Serializable
data class AwardOrganization(
    val id: String,
    val slug: String,
    val nameAr: String,
    val nameEn: String?,
    val description: String,
    val websiteUrl: String?,
)

@Serializable
data class AwardCategory(
    val id: String,
    val slug: String,
    val nameAr: String,
    val nameEn: String?,
    val description: String,
)

@Serializable
data class AwardCeremony(
    val id: String,
    val year: Long,
    val edition: Long?,
    val label: String,
    val heldOn: String?,
    val sourceUrl: String?,
)

@Serializable
data class AwardRecognition(
    val id: String,
    val installmentId: String?,
    val organizationSlug: String,
    val organizationName: String,
    val category: String,
    val year: Long?,
    val result: String,
    val isFeatured: Boolean,
    val sourceUrl: String?,
    val notes: String?,
    val position: Long,
    val organization: AwardOrganization?,
    val awardCategory: AwardCategory?,
    val ceremony: AwardCeremony?,
)

@Serializable
data class WorkDetail(
    val id: String,
    val canonicalTitle: String,
    val titleAr: String?,
    val summary: String,
    val releaseYear: Long?,
    val format: String,
    val audience: String,
    val age: String,
    val poster: Artwork?,
    val installmentCount: Long,
    val episodeCount: Long,
    val contentWarnings: String?,
    val analysisNotes: String?,
    val sexualityRisk: String,
    val behavioralRisk: String,
    val theologyRisk: String,
    val externalIds: ExternalIds,
    val aliases: List<Alias>,
    val trivia: List<String>,
    val genres: List<Vocabulary>,
    val contributions: List<Contribution>,
    val relations: List<Relation>,
    val artwork: List<ArtworkAssignment>,
    val installments: List<Installment>,
    val curatorNotes: String,
    val qualityScore: Long,
    val verifiedAt: String?,
    val createdAt: String,
    val updatedAt: String,
    val externalReferences: List<ExternalReference>,
    val tones: List<Vocabulary>,
    val tags: List<Vocabulary>,
    val countries: List<Vocabulary>,
    val planets: List<Planet>,
    val awards: List<AwardRecognition>,
    val sortTitle: String,
)

@Serializable
data class WorkPage(
    val items: List<WorkSummary>,
    val page: Long,
    val pageSize: Long,
    val total: Long,
)

@Serializable
data class CatalogFilters(
    val genres: List<Vocabulary>,
    val formats: List<String>,
    val audiences: List<String>,
    val statuses: List<String>,
    val yearMin: Long?,
    val yearMax: Long?,
)
