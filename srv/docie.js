const cds = require('@sap/cds');
const FormData = require('form-data');
const fs = require('fs');
const { exec } = require('@sap/cds');
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
const { getDestination, retrieveJwt } = require("@sap-cloud-sdk/connectivity");
const { toXML } = require('jstoxml');


module.exports = cds.service.impl(async (srv) => {
    let cachedClientId;
    let sDocumentId;
    let mapResult;
    let sImportedHeaderCommentStaging;

        srv.on('uploadDocument', async (req) => {
            try {
                let filePath = './srv/files/Demo_API_devis2479058.pdf';
                let form = new FormData();
                const sClientId = await executeHttpRequest({ destinationName: 'DIE-service' }, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json'
                    },
                    url: 'clients?limit=10'
                })
            
                form.append('file', fs.createReadStream(filePath));
                form.append('options', JSON.stringify({
                    "schemaName": "Vinci_Devis_Invoice_Schema",
                    "clientId": sClientId.data.payload[0].clientId,
                    "documentType": "invoice",
                    "schemaVersion": "1"
                }));
                console.log(form)
                const uploadDoc = await executeHttpRequest({ destinationName: 'DIE-service' }, {
                    method: 'POST',
                    headers: form.getHeaders(),
                    url: 'document/jobs',
                    data: form
                }, {
                    fetchCsrfToken: false
                })
                //console.log(uploadDoc.data)
                sDocumentId = uploadDoc.data.id
                //return sDocumentId;
            } catch (err) {
                console.error('Request failed:', err);
                if (err.response) {
                    console.error('Status:', err.response.status);
                    console.error('Message:', err.response.data?.error?.message);
                    if (err.response.data?.error?.details) {
                        console.error('Details:', JSON.stringify(err.response.data.error.details, null, 2));
                    }
                }
                throw new Error('Failed to upload document');
            }
        }),



        srv.on('getDocumentResult', async (req) => {
            try {
                const docResult = await executeHttpRequest({ destinationName: 'DIE-service' }, {
                    method: 'GET',
                    headers: {
                        "Accept": 'application/json',
                        "Content-Type": 'application/json'
                    },
                    url: 'document/jobs/' + sDocumentId
                    
                })
                mapResult = JSON.stringify(docResult.data.extraction)
                return docResult.data.extraction;
            } catch (err) {
                console.error('Request failed:', err.message);
                if (err.response) {
                    console.error('Status:', err.response.status);
                    console.error('Message:', err.response.data?.error?.message);
                    if (err.response.data?.error?.details) {
                        console.error('Details:', JSON.stringify(err.response.data.error.details, null, 2));
                    }
                }
                throw new Error('Failed to get document results');
            }
        })


    function resultMapping(sResult) {
        const oData = JSON.parse(sResult);
        const headerMap = Object.fromEntries(oData.headerFields.map(({ name, value }) => [name, value]));
        const sPriceCurrency = headerMap['PriceCurrency'];
        console.log("sPriceCurrency " + sPriceCurrency)
        const aToConvert = oData.lineItems.map((fields, i) => {
            const itemMap = Object.fromEntries(fields.map(({ name, value, rawValue }) => [name, name === 'UnitOfMeasure' ? rawValue : value]));
            console.log("itemMap " + itemMap)
            return buildItem(i, {
                sDescription: itemMap['Description'],
                sPriceAmount: itemMap['PriceAmount'],
                sSupplierPartNumber: itemMap['SupplierPartNumber'],
                sUnitOfMeasure: itemMap['UnitOfMeasure'],
                sPriceCurrency
            });
        });
        return [aToConvert, oData.lineItems.length];
    }

    function buildItem(i, {
        sDescription,
        sPriceAmount,
        sSupplierPartNumber,
        sUnitOfMeasure,
        sPriceCurrency
    }) {
        return {
            _name: 'urn:item',
            _content: [
                { 'urn:ShortName': '' },
                {
                    _name: 'urn:BillingAddress',
                    _content: { 'urn:UniqueName': 'A309' }
                },
                {
                    _name: 'urn:CommodityCode',
                    _content: { 'urn:UniqueName': 'F999' }
                },
                {
                    _name: 'urn:Description',
                    _content: [
                        {
                            _name: 'urn:CommonCommodityCode',
                            _content: [
                                { 'urn:Domain': 'custom' },
                                { 'urn:UniqueName': 'F999' }
                            ]
                        },
                        { 'urn:Description': sDescription },
                        {
                            _name: 'urn:Price',
                            _content: [
                                { 'urn:Amount': sPriceAmount },
                                {
                                    _name: 'urn:Currency',
                                    _content: { 'urn:UniqueName': sPriceCurrency }
                                }
                            ]
                        },
                        { 'urn:SupplierPartNumber': sSupplierPartNumber },
                        { 'urn:SupplierPartAuxiliaryID': '' },
                        {
                            _name: 'urn:UnitOfMeasure',
                            _content: { 'urn:UniqueName': sUnitOfMeasure }
                        }
                    ]
                },
                {
                    _name: 'urn:ImportedAccountingsStaging',
                    _content: [
                        {
                            _name: 'urn:SplitAccountings',
                            _content: [
                                {
                                    _name: 'urn:item',
                                    _content: [
                                        {
                                            _name: 'urn:GeneralLedger',
                                            _content: [
                                                {
                                                    _name: 'urn:CompanyCode',
                                                    _content: { 'urn:UniqueName': 'F096' }
                                                },
                                                { 'urn:UniqueName': '0000000002' }
                                            ]
                                        },
                                        { 'urn:NumberInCollection': '1' },
                                        { 'urn:Percentage': '100' },
                                        {
                                            _name: 'urn:ProcurementUnit',
                                            _content: { 'urn:UniqueName': 'MUA309' }
                                        },
                                        {
                                            _name: 'urn:WBSElement',
                                            _content: { 'urn:UniqueName': '' }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                { 'urn:ImportedAccountTypeStaging': 'P' },
                { 'urn:ImportedDeliverToStaging': '' },
                {
                    _name: 'urn:ItemCategory',
                    _content: { 'urn:UniqueName': 'M' }
                },
                { 'urn:NumberInCollection': i + 1 },
                { 'urn:Quantity': '1' },
                {
                    _name: 'urn:ShipTo',
                    _content: { 'urn:UniqueName': 'A309' }
                },
                {
                    _name: 'urn:Supplier',
                    _content: { 'urn:UniqueName': '1410017520' }
                },
                {
                    _name: 'urn:SupplierLocation',
                    _content: [
                        { 'urn:ContactID': '1410017520' },
                        { 'urn:UniqueName': '1410017520' }
                    ]
                },
                {
                    _name: 'urn:custom',
                    _content: [
                        {
                            _name: 'urn:CustomAddress',
                            _attrs: { name: 'SapPlantEurovia' },
                            _content: { 'urn:UniqueName': 'A309' }
                        },
                        {
                            _name: 'urn:CustomString',
                            _attrs: { name: 'MaterialNumber' },
                            _content: '10F99999999'
                        }
                    ]
                }
            ]
        };
    }
    

    srv.on('convertToXml', async (req) => {
        let aResult = resultMapping(mapResult);
        const content = {
            _name: 'soapenv:Envelope',
            _attrs: {
                'xmlns:soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
                'xmlns:urn': 'urn:Ariba:Buyer:vsap'
            },
            _content: {
                'soapenv:Body': [
                    {
                        _name: 'urn:RequisitionImportPullRequest',
                        _attrs: {
                            'partition': '?',
                            'variant': '?'
                        },
                        _content: {
                            'urn:Requisition_RequisitionImportPull_Item': [
                                {
                                    _name: 'urn:item',
                                    _content: [
                                        {
                                            _name: 'urn:CompanyCode',
                                            _content: [
                                                {
                                                    'urn:UniqueName': 'F096'  /////
                                                }
                                            ]
                                        },
                                        {
                                            'urn:ImportedHeaderCommentStaging': 'Référence devis : ' + sImportedHeaderCommentStaging ////
                                        },
                                        {
                                            _name: 'urn:LineItems',
                                            _content: aResult[0]
                                        },
                                        {
                                            'urn:Name': 'OCR Vinci' /////
                                        },
                                        {
                                            'urn:OriginatingSystem': 'OCR Vinci' ////
                                        },
                                        {
                                            'urn:OriginatingSystemReferenceID': sImportedHeaderCommentStaging + "_NEW3" ////
                                        },
                                        {
                                            _name: 'urn:ProcurementUnit',
                                            _content: {
                                                'urn:UniqueName': 'MUA309' ////
                                            }
                                        },
                                        {
                                            _name: 'urn:Preparer',
                                            _content: [
                                                {
                                                    'urn:PasswordAdapter': 'PasswordAdapter1'  ////
                                                },
                                                {
                                                    'urn:UniqueName': 'MABOUZAID' ////
                                                }
                                            ]
                                        },
                                        {
                                            _name: 'urn:Requester',
                                            _content: [
                                                {
                                                    'urn:PasswordAdapter': 'PasswordAdapter1'  ////
                                                },
                                                {
                                                    'urn:UniqueName': 'MABOUZAID' ////
                                                }
                                            ]
                                        },
                                        {
                                            'urn:UniqueName': 'TEST_OCR12345' ////
                                        },
                                        {
                                            _name: 'urn:custom',
                                            _content: {
                                                _name: 'urn:CustomPurchaseGroup',
                                                _attrs: {
                                                    'name': 'Office'
                                                },
                                                _content: {
                                                    'urn:UniqueName': '16S' ////
                                                }
                                            }
                                        }

                                    ]
                                }
                            ]
                        }
                    }
                ],
                'soapenv:Binding': [
                    {
                        _name: 'urn:RequisitionImportPullOperation',
                        _attrs: {
                            'soapAction': 'New'
                        }
                    }
                ]
            }
        };
        const xmlOptions = {
            header: true,
            indent: '  '
        }
        console.log(toXML(content, xmlOptions))
        // let sAriba = await sendToAriba(toXML(content, xmlOptions))
                // console.log(sAriba);
    })

    async function sendToAriba(sXML) {
        try {
            const sendAriba = await executeHttpRequest({ destinationName: 'ARIBA-service' }, {
                method: 'POST',
                headers: {
                    "Content-Type": "text/xml"
                },
                data: sXML
            }, {
                fetchCsrfToken: false
            })
            return sendAriba.data
        } catch (err) {
            console.error('SOAP Request Failed:', err.message);
            req.error(500, 'SOAP Request Failed');
        }
    }


})
