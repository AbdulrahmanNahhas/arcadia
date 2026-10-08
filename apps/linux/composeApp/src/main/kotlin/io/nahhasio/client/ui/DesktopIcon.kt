package io.nahhasio.client.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

enum class DesktopSymbol { Library, Saved, Download }

@Composable
fun DesktopIcon(symbol: DesktopSymbol) {
    Canvas(Modifier.size(18.dp)) {
        val unit = size.width / 18f
        val color = DesktopPalette.muted
        val stroke = Stroke(1.4f * unit)
        when (symbol) {
            DesktopSymbol.Library -> listOf(2f to 2f, 10f to 2f, 2f to 10f, 10f to 10f).forEach { (x, y) ->
                drawRoundRect(color, Offset(x * unit, y * unit), Size(6f * unit, 6f * unit), CornerRadius(unit), style = stroke)
            }
            DesktopSymbol.Saved -> drawPath(Path().apply {
                moveTo(5f * unit, 2f * unit); lineTo(13f * unit, 2f * unit)
                lineTo(13f * unit, 16f * unit); lineTo(9f * unit, 12f * unit)
                lineTo(5f * unit, 16f * unit); close()
            }, color, style = stroke)
            DesktopSymbol.Download -> {
                drawLine(color, Offset(9f * unit, unit), Offset(9f * unit, 12f * unit), stroke.width)
                drawLine(color, Offset(5f * unit, 8f * unit), Offset(9f * unit, 12f * unit), stroke.width)
                drawLine(color, Offset(13f * unit, 8f * unit), Offset(9f * unit, 12f * unit), stroke.width)
                drawLine(color, Offset(3f * unit, 16f * unit), Offset(15f * unit, 16f * unit), stroke.width)
            }
        }
    }
}
