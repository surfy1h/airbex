var log = require('../log')(__filename)
, debug = log.debug
, num = require('num')
, util = require('util')
, async = require('async')
, prefix = '[snow:cryptoout]'
, out = require('./out')

var CryptoOut = module.exports = exports = function(ep, dbClient)
{
    debug('CryptoOut ', ep.currency)
    var Bitcoin = require('bitcoin').Client
    this.bitcoin = new Bitcoin(ep)
    this.client = dbClient
    this.currency = ep.currency
    this.currencyLC = this.currency.toLowerCase();
    this.loop()
}

CryptoOut.prototype.loop = function() {
    var that = this

    async.forever(function(cb) {
        that.work(function(err) {
            if (err) return cb(err)
            setTimeout(cb, 10e3)
        })
    }, function(err) {
        console.error('%s processing has failed. this should never happen.', prefix)
        console.error('%s', prefix, err)
        console.error('%s', prefix, err.stack)
    })
}

CryptoOut.prototype.work = function(cb) {
    var that = this

    out.popBatch(this.client, this.currency, function(err, requests) {
        if (err) return cb(err)
        if (!requests) return cb()
        debug('found %d requests', requests.length)
        that.executeBatch(requests, cb)
    })
}

// returns only the valid addresses
CryptoOut.prototype.validateAddresses = function(requests, cb) {
    var that = this
    , validRequests = []

    async.each(requests, function(request, cb) {
        that.bitcoin.validateAddress(request.address, function(err, res) {
            if (!err && res.isvalid) {
                console.log('address %s validated', request.address)
                validRequests.push(request)
                return cb()
            }

            if (err) {
                console.error('%s failed to validate address %s', prefix, request.address)
                console.error(prefix, err)
            } else {
                console.error('%s address %s is invalid, trying to abort',
                    prefix, request.address)
            }

            out.cancelRequest(that.client, request, 'invalid address', function(err) {
                if (err) {
                    console.error('%s failed to abort request with invalid address %s',
                        prefix, request.request_id)

                    return cb()
                }

                console.log('the request %s was aborted', request.request_id)

                cb()
            })
        })
    }, function(err) {
        if (err) return cb(err)
        cb(null, validRequests)
    })
}

CryptoOut.prototype.executeBatch = function(requests, cb) {
    async.waterfall([
        this.validateAddresses.bind(this, requests),
        function(requests, next) {
            if (!requests.length) {
                console.error('no requests are valid, skipping this batch')
                return cb()
            }
            next(null, requests)
        },
        this.sendBatch.bind(this)
    ], cb)
}

// converts requests into a command to sendMany
exports.formatRequestsToSendMany = function(requests) {
    return requests.reduce(function(r, i) {
        debug('formatRequestsToSendMany amount: %s, scale: %s', i.amount, i.scale); 
        var amount = num(i.amount, i.scale).toString()
        r[i.address] = +(num(+(r[i.address] || 0)).add(amount))
        return r
    }, {})
}

CryptoOut.prototype.sendBatch = function(requests, cb) {
    var that = this

    console.log('will send %d transactions', requests.length)
    debug(util.inspect(requests))

    var cmd = exports.formatRequestsToSendMany(requests)

    debug('formatted requests:')
    debug(util.inspect(cmd))

    this.bitcoin.sendMany('', cmd, function(err, res) {
        if (!err) {
            console.log('send requests successful')
            debug(util.inspect(res))

            return async.each(requests, function(request, cb) {
                async.parallel([
                    // Mark complete
                    function(cb) {
                        out.markRequestCompleted(that.client, request, cb)
                    },

                    // Store transaction id
                    function(cb) {
                        that.client.query({
                            text: [
                                'UPDATE crypto_withdraw_request',
                                'SET txid = $1',
                                'WHERE request_id = $2'
                            ].join('\n'),
                            values: [res, request.request_id]
                        }, cb)
                    }
                ], cb)
            }, function(err) {
                if (!err) return cb()
                console.error('%s failed to mark items as done', prefix)
                console.error('%s', prefix, err)
                cb(err)
            })
        }
        
        log.error("cannot send, try requeing: ", err.message);
        
        console.error('request failed because wallet is lacking funds. trying to re-queue requests')

        return out.reQueue(that.client, requests, function(err) {
            if (!err) {
                debug('succeeded in requeing the requests')
                return cb()
            }

            log.error('%s failed to requeue the requests', prefix)
            log.error('%s', err)
            return cb()
        })

       
    })
}
