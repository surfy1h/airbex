/* global -numbers */
var Num = require('num')
, _ = require('lodash')

/* jshint maxcomplexity: 99 */
module.exports = exports = function(n, opts, currency) {
    if (typeof opts == 'number') {
        opts = { precision: opts }
    }

    opts = _.extend({ thousands: true, trim: true }, opts)

    if (currency) {
        opts.currency = currency
    }

    // Number might be Num
    n = Num(n)

    // Fixed, min and max precision
    if (opts.precision !== undefined) {
        n.set_precision(opts.precision)
    } else if (opts.maxPrecision !== undefined && n._precision > opts.maxPrecision) {
        n.set_precision(opts.maxPrecision)
    } else if (opts.minPrecision !== undefined && n._precision < opts.minPrecision) {
        n.set_precision(opts.minPrecision)
    }

    var s = n.toString()

    // Trim unnecessary zeroes
    if (!opts.precision && (opts.trim || opts.trimRight)) {
        if (~s.indexOf('.')) {
            s = s.replace(/\.?0*$/, '')
        }
    }

    // Decmial separator
    var ds = i18n('numbers.decimalSeparator') || '.'
    s = s.replace(/\./, ds)

    // Thousand separator (left)
    var ts

    if (opts.thousands === true) {
        ts = i18n('numbers.thousandSeparator')
    } else if (opts.thousands) {
        ts = opts.thousands
    }

    if (ts) {
        s = exports.addThousands(s, ds, ts)
    }

    if (opts.currency) {
        s = s + ' ' + opts.currency
    }

    return s
}

exports.format = exports

exports.addThousands = function(s, ds, ts) {
    var parts = s.split(ds)
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ts)
    return parts.join(ds)
}

exports.formatCurrency = function(number, currency) {
    var scale_display = api.currencies[currency].scale_display
    //console.log("formatCurrency %s %s, scale: %s", number, currency, scale_display)
    return this.format(Num(number).round(scale_display).toString(), {
        currency: currency,
        thousands: true,
        precision: scale_display
    })
}

exports.formatAmount = function(number, currency) {
	var scale = api.currencies[currency].scale
    return this.format(number, {
        currency: currency,
        thousands: true
    })
}

exports.formatVolume = function(number, currency) {
    return this.format(number, {
        currency: currency,
        thousands: true,
        maxPrecision: 8
    })
}

exports.formatPrice = function(number) {
    return this.format(number, {
        thousands: true,
        maxPrecision: 8
    })
}

exports.getCurrencyOption = function(currency) {
    var option = api.currencies[currency]
    return option;
}

exports.getCurrencyNum = function(value, currency) {
    var scale = api.currencies[currency].scale
    , result = Num(value).mul(Math.pow(10, scale))
    result.set_precision(0)
    return result
}

exports.parse = function(s) {
    // Remove spaces
    s = s.replace(/\s/g, '')

    s = s.replace(new RegExp(i18n('numbers.thousandSeparator'), 'g'), '')

    var allowed = [
        '0-9',
        '\\' + i18n('numbers.decimalSeparator'),
        '.',
        '\\' + i18n('numbers.thousandSeparator')
    ]

    var expr = '^-?[' + allowed.join('') + ']+$'

    if (!new RegExp(expr).exec(s)) {
        return null
    }

    s = s.replace(i18n('numbers.decimalSeparator'), '.')

    if (isNaN(+s)) {
        return null
    }

    return Num(s).toString()
}
