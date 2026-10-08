package io.nahhasio.client.api

import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.CompletableFuture
import kotlinx.serialization.json.*
import io.nahhasio.client.generated.*

class ApiException(val status: Int, message: String) : Exception(message)

/** Sessions live in memory until secure desktop credential storage is introduced. */
class NahhasioApi(server: String) {
    val baseUrl = server.trim().trimEnd('/').also {
        val uri = URI(it)
        require(uri.scheme in listOf("http", "https") && uri.host != null && uri.userInfo == null && uri.query == null && uri.fragment == null) {
            "عنوان الخادم يجب أن يبدأ بـ http أو https"
        }
        require(uri.scheme == "https" || uri.host in listOf("localhost", "127.0.0.1", "::1")) {
            "استخدم HTTPS عند الاتصال بجهاز آخر"
        }
    }
    private val http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()
    private val json = Json { ignoreUnknownKeys = true }
    private var token: String? = null

    suspend fun login(email: String, password: String): String {
        val response = json.decodeFromJsonElement<LoginResponse>(request("/api/v1/auth/login", "POST", buildJsonObject {
            put("email", email.trim()); put("password", password)
        }))
        token = response.token
        return response.user.name
    }

    suspend fun logout() {
        try { request("/api/v1/auth/logout", "POST") } finally { token = null }
    }

    suspend fun works(filters: LibraryFilters): WorkPage {
        val values = linkedMapOf("page" to filters.page.toString(), "pageSize" to "24", "sort" to filters.sort)
        listOf("q" to filters.query, "format" to filters.format, "audience" to filters.audience,
            "genre" to filters.genre, "status" to filters.status, "yearFrom" to filters.yearFrom,
            "yearTo" to filters.yearTo).filter { it.second.isNotBlank() }.forEach { values[it.first] = it.second }
        val query = values.entries.joinToString("&") { "${it.key}=${URLEncoder.encode(it.value, Charsets.UTF_8)}" }
        return json.decodeFromJsonElement<WorkPage>(request("/api/v1/works?$query"))
    }

    suspend fun work(id: String): WorkDetail = json.decodeFromJsonElement(request("/api/v1/works/${URLEncoder.encode(id, Charsets.UTF_8)}"))

    suspend fun filters(): CatalogFilters = json.decodeFromJsonElement(request("/api/v1/catalog/filters"))

    suspend fun artwork(path: String): ByteArray = withContext(Dispatchers.IO) {
        require(path.matches(Regex("/api/v1/artwork/[a-zA-Z0-9-]+")))
        val builder = HttpRequest.newBuilder(URI(baseUrl + path)).timeout(Duration.ofSeconds(20))
        token?.let { builder.header("Authorization", "Bearer $it") }
        val response = http.sendAsync(builder.build(), HttpResponse.BodyHandlers.ofInputStream()).awaitResponse()
        response.body().use { input ->
            if (response.statusCode() != 200) throw ApiException(response.statusCode(), "تعذر تحميل الصورة")
            val bytes = input.readNBytes(16 * 1024 * 1024 + 1)
            require(bytes.size <= 16 * 1024 * 1024) { "الصورة أكبر من الحد المسموح" }
            bytes
        }
    }

    private suspend fun request(path: String, method: String = "GET", body: JsonObject? = null): JsonElement = withContext(Dispatchers.IO) {
        val builder = HttpRequest.newBuilder(URI(baseUrl + path)).timeout(Duration.ofSeconds(25)).header("Accept", "application/json")
        token?.let { builder.header("Authorization", "Bearer $it") }
        if (body != null) builder.header("Content-Type", "application/json")
        builder.method(method, body?.let { HttpRequest.BodyPublishers.ofString(it.toString()) } ?: HttpRequest.BodyPublishers.noBody())
        val response = http.sendAsync(builder.build(), HttpResponse.BodyHandlers.ofString()).awaitResponse()
        if (response.statusCode() !in 200..299) {
            val message = runCatching { json.parseToJsonElement(response.body()).jsonObject["message"]?.jsonPrimitive?.content }.getOrNull()
            throw ApiException(response.statusCode(), message ?: "تعذر الطلب (${response.statusCode()})")
        }
        if (response.body().isBlank()) JsonNull else json.parseToJsonElement(response.body())
    }
}

private suspend fun <T> CompletableFuture<T>.awaitResponse(): T = suspendCancellableCoroutine { continuation ->
    continuation.invokeOnCancellation { cancel(true) }
    whenComplete { result, failure ->
        if (failure != null) continuation.resumeWith(Result.failure(failure))
        else continuation.resumeWith(Result.success(result))
    }
}

data class LibraryFilters(val query: String = "", val sort: String = "title", val format: String = "",
    val audience: String = "", val genre: String = "", val status: String = "", val yearFrom: String = "",
    val yearTo: String = "", val page: Int = 1)
