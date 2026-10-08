package io.nahhasio.client.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.toComposeImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import io.nahhasio.client.api.NahhasioApi
import org.jetbrains.skia.Image

@Composable
fun Artwork(api: NahhasioApi, path: String, title: String, modifier: Modifier = Modifier) {
    var bitmap by remember(path) { mutableStateOf<ImageBitmap?>(null) }
    var failed by remember(path) { mutableStateOf(false) }
    LaunchedEffect(api, path) {
        try { bitmap = Image.makeFromEncoded(api.artwork(path)).toComposeImageBitmap() }
        catch (e: kotlinx.coroutines.CancellationException) { throw e }
        catch (_: Exception) { failed = true }
    }
    if (bitmap != null) Image(bitmap!!, contentDescription = title, modifier = modifier, contentScale = ContentScale.Crop)
    else Box(modifier) { if (failed) Text("الصورة غير متاحة", Modifier.padding(12.dp)) }
}
